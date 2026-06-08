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
  fetchWithRetry,
} from '@/lib/rag';

const ZHIPU_API_BASE = 'https://open.bigmodel.cn/api/paas/v4';

export async function GET() {
  try {
    const { count: projCount, error: projError } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: chunkCount, error: chunkError } = await supabase.from('embedding_chunks').select('*', { count: 'exact', head: true });
    if (projError || chunkError) return Response.json({ ok: false, projError: projError?.message, chunkError: chunkError?.message });
    return Response.json({
      ok: true,
      projects: projCount ?? 0,
      chunks: chunkCount ?? 0,
      supabaseUrl: process.env.SUPABASE_URL ? '✅ set' : '❌ missing',
      supabaseKey: process.env.SUPABASE_SERVICE_KEY ? '✅ set' : '❌ missing',
      zhipuKey: process.env.ZHIPU_RAG_API_KEY ? '✅ set' : '❌ missing',
    });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) });
  }
}

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
    const apiKey = process.env.ZHIPU_RAG_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API 未配置' }), { status: 502 });
    }

    const glmRes = await fetchWithRetry(
      `${ZHIPU_API_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.ZHIPU_MODEL || 'glm-4.7',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.7,
          max_tokens: mode === 'guided' ? 1500 : 1024,
        }),
      },
      3,     // 最多重试 3 次（共 4 次尝试）
      1000,  // 基础延迟 1s → 1s, 2s, 4s
    );

    if (!glmRes.ok) {
      const errText = await glmRes.text();
      console.error('GLM API error:', glmRes.status, errText);
      let detail = 'AI 服务暂时不可用';
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) detail = errJson.error.message;
      } catch { /* keep default */ }
      if (glmRes.status === 429) {
        detail = '服务繁忙，请稍后重试';
      } else if (glmRes.status === 408 || glmRes.status === 504) {
        detail = 'AI 服务响应超时，请重试';
      }
      return new Response(JSON.stringify({ error: detail }), { status: 502 });
    }

    // SSE 流
    const encoder = new TextEncoder();
    let fullText = '';

    // 后处理：解析选项 / 建议 / 项目引用（正常完成和流中断共用）
    const finalizeStream = (text: string, send: (data: object) => void) => {
      const options = parseOptions(text);
      if (options.length > 0) send({ type: 'options', items: options });

      const suggestions = parseSuggestions(text);
      if (suggestions.length > 0) send({ type: 'suggestions', items: suggestions });

      let projectRefs = parseProjectRefs(text);
      if (projectRefs.length === 0) {
        const textLower = text.toLowerCase();
        const topChunkOwners = [...new Set((topChunks as { repo_full_name: string }[]).map(c => c.repo_full_name))];
        projectRefs = topChunkOwners.filter(name =>
          textLower.includes(name.toLowerCase()),
        );
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
        if (uniqueProjects.length > 0) send({ type: 'projects', projects: uniqueProjects });
      }
    };

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

          // 正常完成：后处理
          if (fullText.length === 0) {
            // GLM 返回空响应（限流/故障），通知前端
            send({ type: 'done', error: 'empty_response' });
          } else {
            finalizeStream(fullText, send);
            send({ type: 'done' });
          }
        } catch (err) {
          console.error('Stream error:', err);
          // 已有部分输出 → 保留给用户，执行后处理后正常结束
          if (fullText.length > 0) {
            finalizeStream(fullText, send);
            send({ type: 'done' });
          } else {
            send({ type: 'done', error: 'Stream interrupted' });
          }
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
