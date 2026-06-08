import { NextRequest } from 'next/server';
import type { Project, ChatMessage } from '@/lib/project-types';
import { supabase } from '@/lib/supabase';
import {
  embedQuery,
  buildGuidedPrompt,
  buildAssistantPrompt,
  parseOptions,
  parseSuggestions,
  parseProjectRefs,
} from '@/lib/rag';

const ZHIPU_API_BASE = 'https://open.bigmodel.cn/api/paas/v4';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      question,
      history = [],
      mode = 'assistant',
      category,
    } = body as {
      question?: string;
      history?: ChatMessage[];
      mode?: 'guided' | 'assistant';
      category?: string;
    };

    if (!question || typeof question !== 'string' || !question.trim()) {
      return new Response(JSON.stringify({ error: '问题不能为空' }), { status: 400 });
    }

    // 向量化查询
    const queryVec = await embedQuery(question.trim());

    // Supabase 向量检索
    const { data: topChunks, error: rpcError } = await supabase.rpc(
      'match_chunks',
      {
        query_embedding: queryVec,
        match_count: 5,
        filter_category: category || null,
      },
    );

    if (rpcError) {
      console.error('Supabase RPC error:', rpcError);
      return new Response(JSON.stringify({ error: `检索失败: ${rpcError.message}` }), { status: 503 });
    }

    if (!topChunks || topChunks.length === 0) {
      return new Response(JSON.stringify({ error: '项目数据暂未就绪' }), { status: 503 });
    }

    // 加载项目元数据（用于 Prompt 构建 + 项目卡片匹配）
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('*');

    if (projError || !projects) {
      console.error('Supabase projects error:', projError?.message);
      return new Response(JSON.stringify({ error: '项目数据暂未就绪' }), { status: 503 });
    }

    // 根据 mode 选择 Prompt
    const prompt = mode === 'guided'
      ? buildGuidedPrompt(history, question.trim(), topChunks, projects as Project[], category)
      : buildAssistantPrompt(history, question.trim(), topChunks, projects as Project[]);

    // 流式调用 GLM
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API 未配置' }), { status: 502 });
    }

    let glmRes: Response;
    try {
      glmRes = await fetch(`${ZHIPU_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.ZHIPU_MODEL || 'glm-4.7-flash',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.7,
          max_tokens: mode === 'guided' ? 1500 : 1024,
        }),
      });
    } catch (err) {
      console.error('GLM fetch failed, retrying...', err);
      // 重试一次
      glmRes = await fetch(`${ZHIPU_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.ZHIPU_MODEL || 'glm-4.7-flash',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.7,
          max_tokens: mode === 'guided' ? 1500 : 1024,
        }),
      });
    }

    if (!glmRes.ok) {
      const errText = await glmRes.text();
      console.error('GLM API error:', glmRes.status, errText);
      let detail = 'AI 服务暂时不可用';
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) detail = errJson.error.message;
      } catch { /* keep default */ }
      return new Response(JSON.stringify({ error: detail }), { status: 502 });
    }

    // SSE 流
    const encoder = new TextEncoder();
    let fullText = '';

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const reader = glmRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop()!;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;

              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullText += content;
                  send({ type: 'chunk', content });
                }
              } catch {
                // 跳过不合法的 JSON
              }
            }
          }

          // 解析结构化选项（引导模式）
          const options = parseOptions(fullText);
          if (options.length > 0) {
            send({ type: 'options', items: options });
          }

          // 解析追问建议
          const suggestions = parseSuggestions(fullText);
          if (suggestions.length > 0) {
            send({ type: 'suggestions', items: suggestions });
          }

          // 解析项目引用 → 查找完整数据
          let projectRefs = parseProjectRefs(fullText);

          // Fallback: LLM 可能没用 <project> 标签，从文本中匹配已知项目名
          if (projectRefs.length === 0) {
            const textLower = fullText.toLowerCase();
            const topChunkOwners = [...new Set((topChunks as { repo_full_name: string }[]).map(c => c.repo_full_name))];
            // 优先匹配检索到的 chunk 中的项目
            projectRefs = topChunkOwners.filter(name =>
              textLower.includes(name.toLowerCase()),
            );
            // 如果还不够，扩展到全库匹配
            if (projectRefs.length === 0) {
              const allProjects = projects as Project[];
              projectRefs = allProjects
                .map(p => p.full_name)
                .filter(name => textLower.includes(name.toLowerCase()));
            }
          }

          if (projectRefs.length > 0) {
            const matchedProjects = projectRefs
              .map((ref: string) => (projects as Project[]).find(p =>
                p.full_name === ref || p.full_name.toLowerCase() === ref.toLowerCase(),
              ))
              .filter((p): p is Project => p !== undefined);

            const uniqueProjects = [...new Map(matchedProjects.map(p => [p.id, p])).values()];
            if (uniqueProjects.length > 0) {
              send({ type: 'projects', projects: uniqueProjects });
            }
          }

          send({ type: 'done' });
        } catch (err) {
          console.error('Stream error:', err);
          send({ type: 'done', error: 'Stream interrupted' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('API error:', err);
    return new Response(
      JSON.stringify({ error: '服务内部错误' }),
      { status: 500 },
    );
  }
}
