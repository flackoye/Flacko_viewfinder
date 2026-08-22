import { NextRequest } from 'next/server';
import type { Project, ChatHistoryMessage, EmbeddingChunk, GuidedProgress, ProjectsRequestBody } from '@/lib/project-types';
import { CATEGORY_MAP } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import {
  embedQuery,
  buildGuidedPrompt,
  buildAssistantPrompt,
  parseOptions,
  parseSuggestions,
  parseGuidedProgress,
  parseProjectRefs,
  fetchWithRetry,
} from '@/lib/rag';

const LLM_API_BASE = process.env.LLM_API_BASE || 'https://api.deepseek.com/anthropic';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-v4-flash';
const MAX_QUESTION_LENGTH = 1000;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const MAX_HISTORY_MESSAGES = envInt('RAG_MAX_HISTORY_MESSAGES', 30, 12, 60);
const MAX_HISTORY_MESSAGE_LENGTH = envInt('RAG_MAX_HISTORY_MESSAGE_LENGTH', 4000, 1000, 12000);
const MAX_OUTPUT_TOKENS = envInt('RAG_MAX_OUTPUT_TOKENS', 4096, 1024, 16384);
const MATCH_COUNT = envInt('RAG_MATCH_COUNT', 8, 1, 12);
const MAX_CANDIDATE_CARDS = envInt('RAG_MAX_CANDIDATE_CARDS', 6, 1, 10);
const RETRIEVAL_CONTEXT_LENGTH = envInt('RAG_RETRIEVAL_CONTEXT_LENGTH', 6000, 1000, 16000);

type MatchedChunk = EmbeddingChunk & { score?: number };

async function resolveRecommendedProjects(
  text: string,
  candidates: Project[],
): Promise<Project[]> {
  const explicitRefs = parseProjectRefs(text)
    .filter(ref => /^[\w.-]+\/[\w.-]+$/.test(ref))
    .slice(0, MAX_CANDIDATE_CARDS);

  // `<project>` 是唯一的卡片授权信号。正文中的仓库名可能只是比较或否定项，
  // 不能再通过模糊扫描将它们误渲染为推荐结果。
  if (explicitRefs.length === 0) {
    return [];
  }

  const projectByName = new Map(
    candidates.map(project => [project.full_name.toLowerCase(), project]),
  );
  const missingRefs = explicitRefs.filter(ref => !projectByName.has(ref.toLowerCase()));

  // 合法标签可能引用了项目表中已有、但未进入本轮 top chunks 的仓库。
  // 补查其元数据，避免正文有推荐而卡片缺失；查不到时不会用其他候选顶替。
  if (missingRefs.length > 0) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('full_name', missingRefs);

      if (error) {
        console.warn('Failed to resolve recommended project metadata:', error.message);
      } else {
        for (const project of (data ?? []) as Project[]) {
          projectByName.set(project.full_name.toLowerCase(), project);
        }
      }
    } catch (error) {
      console.warn('Failed to resolve recommended project metadata:', error);
    }
  }

  const ordered = explicitRefs
    .map(ref => projectByName.get(ref.toLowerCase()))
    .filter((project): project is Project => project !== undefined);

  const unresolvedRefs = explicitRefs.filter(ref => !projectByName.has(ref.toLowerCase()));
  if (unresolvedRefs.length > 0) {
    console.warn('LLM referenced projects missing from project index:', unresolvedRefs);
  }

  return [...new Map(ordered.map(project => [project.id, project])).values()];
}

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}

function truncateHistoryContent(content: string): string {
  if (content.length <= MAX_HISTORY_MESSAGE_LENGTH) return content;
  const separator = '\n\n…（中间内容已压缩）…\n\n';
  const remaining = MAX_HISTORY_MESSAGE_LENGTH - separator.length;
  const headLength = Math.ceil(remaining * 0.62);
  const tailLength = remaining - headLength;
  return `${content.slice(0, headLength)}${separator}${content.slice(-tailLength)}`;
}

function sanitizeHistory(value: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is Record<string, unknown> => (
      typeof message === 'object' && message !== null
    ))
    .filter(message => (
      (message.role === 'user' || message.role === 'assistant')
      && typeof message.content === 'string'
    ))
    .slice(-MAX_HISTORY_MESSAGES)
    .map(message => ({
      role: message.role as ChatHistoryMessage['role'],
      content: truncateHistoryContent(message.content as string),
    }));
}

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
      llmKey: process.env.LLM_API_KEY ? '✅ set' : '❌ missing',
    });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: Partial<ProjectsRequestBody>;
    try {
      const parsedBody = await request.json() as unknown;
      if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
        return errorResponse('请求体必须是 JSON 对象', 400);
      }
      body = parsedBody as Partial<ProjectsRequestBody>;
    } catch {
      return errorResponse('请求体必须是合法 JSON', 400);
    }

    const {
      question,
      history = [],
      mode = 'assistant',
      category,
    } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return errorResponse('问题不能为空', 400);
    }
    if (question.trim().length > MAX_QUESTION_LENGTH) {
      return errorResponse(`问题不能超过 ${MAX_QUESTION_LENGTH} 个字符`, 400);
    }
    if (mode !== 'guided' && mode !== 'assistant') {
      return errorResponse('mode 只能是 guided 或 assistant', 400);
    }
    if (category !== undefined && typeof category !== 'string') {
      return errorResponse('category 必须是字符串', 400);
    }
    if (category && !CATEGORY_MAP[category]) {
      return errorResponse('未知的项目分类', 400);
    }

    const safeHistory = sanitizeHistory(history);
    const previousGuidedProgress = mode === 'guided'
      ? [...safeHistory]
          .reverse()
          .filter(message => message.role === 'assistant')
          .map(message => parseGuidedProgress(message.content))
          .find((progress): progress is GuidedProgress => progress !== null) ?? null
      : null;

    // 引导模式的最后一句通常只是“开始推荐”，需要把此前用户回答一起用于检索。
    const retrievalQuery = mode === 'guided'
      ? [
          ...safeHistory
            .filter(message => message.role === 'user')
            .slice(-8)
            .map(message => message.content),
          question.trim(),
        ].join('\n').slice(-RETRIEVAL_CONTEXT_LENGTH)
      : question.trim();
    const queryVec = await embedQuery(retrievalQuery);

    // Supabase 向量检索
    const { data: topChunks, error: rpcError } = await supabase.rpc(
      'match_chunks',
      {
        query_embedding: queryVec,
        match_count: MATCH_COUNT,
        filter_category: category || null,
      },
    );

    if (rpcError) {
      console.error('Supabase RPC error:', rpcError);
      return errorResponse('项目检索暂时不可用', 503);
    }

    if (!topChunks || topChunks.length === 0) {
      console.warn('No embedding chunks matched:', { category: category || 'all' });
      return errorResponse('该分类的项目索引暂时不可用', 503);
    }

    // 只加载检索结果涉及的项目，避免每次对话全表扫描。
    const matchedRepoNames = [...new Set(
      (topChunks as { repo_full_name: string }[]).map(chunk => chunk.repo_full_name),
    )];
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('*')
      .in('full_name', matchedRepoNames);

    if (projError || !projects || projects.length === 0) {
      console.error('Supabase projects error:', projError?.message);
      return errorResponse('项目元数据暂时不可用', 503);
    }

    const retrievedChunks = topChunks as MatchedChunk[];
    const candidateProjects = (projects as Project[])
      .map(project => {
        const projectChunks = retrievedChunks.filter(chunk => chunk.repo_full_name === project.full_name);
        const matchScore = Math.max(0, ...projectChunks.map(chunk => chunk.score ?? 0));
        return {
          ...project,
          match_score: matchScore,
          matched_sections: [...new Set(
            projectChunks.map(chunk => chunk.section_title).filter(Boolean),
          )].slice(0, 3),
        };
      })
      .sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

    // 根据 mode 选择 Prompt
    const prompt = mode === 'guided'
      ? buildGuidedPrompt(
          safeHistory,
          question.trim(),
          topChunks,
          candidateProjects,
          previousGuidedProgress,
          category,
        )
      : buildAssistantPrompt(safeHistory, question.trim(), topChunks, candidateProjects);

    // 流式调用 LLM（anthropic Messages 兼容接口）
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      return errorResponse('AI 服务未配置', 503);
    }

    const llmRes = await fetchWithRetry(
      `${LLM_API_BASE}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          // DeepSeek V4 默认启用 thinking；长 RAG prompt 容易在较小的 max_tokens
          // 内只返回 thinking_delta、没有正文。项目推荐需要稳定的结构化文本，显式关闭。
          thinking: { type: 'disabled' },
          temperature: 0.7,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: request.signal,
      },
      3,     // 最多重试 3 次（共 4 次尝试）
      1000,  // 基础延迟 1s → 1s, 2s, 4s
    );

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('LLM API error:', llmRes.status, errText);
      let detail = 'AI 服务暂时不可用';
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) detail = errJson.error.message;
      } catch { /* keep default */ }
      if (llmRes.status === 429) {
        detail = '服务繁忙，请稍后重试';
      } else if (llmRes.status === 408 || llmRes.status === 504) {
        detail = 'AI 服务响应超时，请重试';
      }
      return errorResponse(detail, 502);
    }

    // SSE 流
    const encoder = new TextEncoder();
    let fullText = '';

    // 后处理：解析选项 / 建议 / 项目引用（正常完成和流中断共用）
    const finalizeStream = async (text: string, send: (data: object) => void) => {
      const options = parseOptions(text);
      if (options.length > 0) send({ type: 'options', items: options });

      const suggestions = parseSuggestions(text);
      if (suggestions.length > 0) send({ type: 'suggestions', items: suggestions });

      const currentProgress = mode === 'guided' ? parseGuidedProgress(text) : null;
      if (currentProgress) send({ type: 'guided_progress', progress: currentProgress });

      const canEmitProjects = mode === 'assistant'
        || (previousGuidedProgress?.ready === true && currentProgress?.ready === true);
      if (canEmitProjects) {
        const outputProjects = await resolveRecommendedProjects(text, candidateProjects);
        if (outputProjects.length > 0) send({ type: 'projects', projects: outputProjects });
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const reader = llmRes.body!.getReader();
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
              if (!dataStr || dataStr === '[DONE]') continue;

              try {
                // anthropic 兼容流式：content_block_delta.delta.type === 'text_delta'
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  const content = parsed.delta.text || '';
                  if (content) {
                    fullText += content;
                    send({ type: 'chunk', content });
                  }
                }
              } catch {
                // 跳过不合法的 JSON
              }
            }
          }

          // 正常完成：后处理
          if (fullText.length === 0) {
            // LLM 返回空响应（限流/故障），通知前端
            send({ type: 'done', error: 'empty_response' });
          } else {
            await finalizeStream(fullText, send);
            send({ type: 'done' });
          }
        } catch (err) {
          console.error('Stream error:', err);
          // 已有部分输出 → 保留给用户，执行后处理后正常结束
          if (fullText.length > 0) {
            await finalizeStream(fullText, send);
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
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('API error:', err);
    if ((err as Error).name === 'AbortError') {
      return errorResponse('请求已取消', 499);
    }
    return errorResponse('服务内部错误', 500);
  }
}
