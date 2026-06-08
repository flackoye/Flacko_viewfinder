import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { RefreshCw } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/lib/project-types';
import { stripTags } from '@/lib/rag';
import ProjectCard from './ProjectCard';

export default function ChatMessage({
  message,
  isStreaming,
  onRetry,
}: {
  message: ChatMessageType;
  isStreaming?: boolean;
  onRetry?: () => void;
}) {
  // 用户消息 — 简洁行内显示
  if (message.role === 'user') {
    return (
      <div className="flex items-start gap-2 py-2 chat-msg-enter">
        <span className="text-accent text-base shrink-0 pt-0.5 font-bold">▸</span>
        <span className="text-text text-base leading-relaxed">{message.content}</span>
      </div>
    );
  }

  // 失败消息 — 显示重试按钮
  if (message.failed && onRetry) {
    return (
      <div className="py-2 chat-msg-enter">
        <div className="flex items-center gap-3">
          <span className="text-base text-red-400/80">{message.content}</span>
          <button
            onClick={onRetry}
            className="glass-btn-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover-lift"
          >
            <RefreshCw className="w-3 h-3" />
            重试
          </button>
        </div>
      </div>
    );
  }

  // AI 回复 — Markdown 渲染 + 嵌入项目卡片
  const displayContent = stripTags(message.content);

  return (
    <div className="py-2 chat-msg-enter">
      {/* Markdown 正文 */}
      {displayContent && (
        <div className="text-base text-text-muted leading-relaxed prose prose-invert max-w-none
          prose-headings:text-text prose-headings:font-semibold
          prose-a:text-accent prose-a:no-underline hover:prose-a:underline
          prose-code:text-accent/80 prose-code:bg-accent/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-bg-deep prose-pre:border prose-pre:border-border prose-pre:rounded-lg
          prose-strong:text-text
          prose-li:text-text-muted
          prose-p:my-2 prose-headings:my-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSlug]}
          >
            {displayContent}
          </ReactMarkdown>
        </div>
      )}

      {/* 流式输出光标 */}
      {isStreaming && <span className="typing-cursor" />}

      {/* 嵌入的项目卡片 */}
      {message.projects && message.projects.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {message.projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
