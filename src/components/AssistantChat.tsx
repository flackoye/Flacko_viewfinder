'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, Compass } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/lib/project-types';
import ChatMessage from '@/components/ChatMessage';

const INITIAL_SUGGESTIONS = [
  '🤖 推荐一些热门的 AI Agent 框架',
  '🔍 RAG 和向量数据库怎么选',
  '⚡ 轻量级的 LLM 推理部署方案',
  '🎨 适合新手的图像生成项目',
];

/** Gemini 风格四角星 */
function GeminiStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill="url(#gemini-assist-grad)"
      />
      <defs>
        <linearGradient id="gemini-assist-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#667eea" />
          <stop offset="0.5" stopColor="#002FA7" />
          <stop offset="1" stopColor="#764ba2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [showWelcome, setShowWelcome] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessageType = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      projects: [],
      suggestions: [],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);
    setShowWelcome(false);
    setSuggestions([]);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text.trim(), history, mode: 'assistant' }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body!.getReader();
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
          if (!trimmed.startsWith('data:')) continue;
          try {
            const data = JSON.parse(trimmed.slice(5).trim());
            switch (data.type) {
              case 'chunk':
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, content: last.content + data.content };
                  }
                  return updated;
                });
                break;
              case 'suggestions':
                setSuggestions(data.items || []);
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, suggestions: data.items || [] };
                  }
                  return updated;
                });
                break;
              case 'projects':
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, projects: data.projects || [] };
                  }
                  return updated;
                });
                break;
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('Chat error:', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: '⚠️ 网络请求失败，请点击重新发送。', failed: true };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 返回导航 + 标题 */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/projects"
          className="glass-btn-outline px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> 返回
        </Link>
        <div className="flex items-center gap-2">
          <GeminiStar className="w-5 h-5" />
          <div>
            <h1 className="text-2xl font-bold klein-gradient-text">自由对话</h1>
            <p className="text-xs text-text-dim">直接描述需求，AI 即时推荐</p>
          </div>
        </div>
      </div>

      {/* 消息区域 */}
      <div
        ref={scrollRef}
        className="space-y-1 mb-6 min-h-[300px] max-h-[60vh] overflow-y-auto pr-2"
      >
        {/* Welcome */}
        {messages.length === 0 && showWelcome && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Compass className="w-12 h-12 text-klein/30 mb-4" />
            <p className="text-text-muted mb-6">描述你的需求，或选择下方话题</p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {INITIAL_SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="glass-btn-outline px-4 py-3 text-sm text-left hover-lift whitespace-normal"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
            onRetry={msg.failed ? () => {
              const prevUserMsg = messages[idx - 1];
              setMessages(prev => prev.slice(0, idx - 1));
              if (prevUserMsg?.role === 'user') {
                setTimeout(() => sendMessage(prevUserMsg.content), 50);
              }
            } : undefined}
          />
        ))}

        {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && (
          <div className="flex items-center gap-2 py-3">
            <span className="thinking-dot" style={{ animationDelay: '0s' }} />
            <span className="thinking-dot" style={{ animationDelay: '0.2s' }} />
            <span className="thinking-dot" style={{ animationDelay: '0.4s' }} />
            <span className="text-xs text-text-dim ml-1">思考中</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="glass p-2 flex items-center gap-2 mt-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="描述你的需求或想法..."
          disabled={isStreaming}
          className="flex-1 bg-transparent border-none outline-none text-text text-sm placeholder:text-text-dim px-3 py-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="glass-btn p-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="发送"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
