'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import type { ChatMessage as ChatMessageType, CategoryInfo } from '@/lib/project-types';
import ChatMessage from '@/components/ChatMessage';
import OptionTable from '@/components/OptionTable';

interface GuidedExploreProps {
  categories: CategoryInfo[];
}

/** 动态阶段 */
const PHASE_LABELS = [
  { id: 1, title: '方向确认' },
  { id: 2, title: '背景调查' },
  { id: 3, title: '需求细化' },
  { id: 4, title: '约束确认' },
  { id: 5, title: '精准推荐' },
];

function computePhases(round: number, hasProjects: boolean) {
  const effective = hasProjects ? 5 : Math.min(round, 4);
  return PHASE_LABELS.map((p, idx) => {
    if (effective > idx + 1) return { ...p, status: 'completed' as const };
    if (effective === idx + 1) return { ...p, status: 'active' as const };
    return { ...p, status: 'locked' as const };
  });
}

export default function GuidedExplore({ categories }: GuidedExploreProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [aiOptions, setAiOptions] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [hasProjects, setHasProjects] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming, aiOptions]);

  const phases = computePhases(round, hasProjects);

  // 核心流式请求函数
  const streamRequest = useCallback(async (
    question: string,
    category?: string,
  ) => {
    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessageType = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setAiOptions([]);
    setInput('');

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, mode: 'guided', category }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotProjects = false;

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
                  const u = [...prev];
                  const l = u[u.length - 1];
                  if (l?.role === 'assistant') u[u.length - 1] = { ...l, content: l.content + data.content };
                  return u;
                });
                break;
              case 'options':
                // 只有在还没推荐项目时才显示选项
                if (!gotProjects) setAiOptions(data.items || []);
                break;
              case 'suggestions':
                setMessages(prev => {
                  const u = [...prev];
                  const l = u[u.length - 1];
                  if (l?.role === 'assistant') u[u.length - 1] = { ...l, suggestions: data.items || [] };
                  return u;
                });
                break;
              case 'projects':
                gotProjects = true;
                setAiOptions([]); // 有项目推荐时清空选项
                setHasProjects(true);
                setRound(5);
                setMessages(prev => {
                  const u = [...prev];
                  const l = u[u.length - 1];
                  if (l?.role === 'assistant') u[u.length - 1] = { ...l, projects: data.projects || [] };
                  return u;
                });
                break;
            }
          } catch { /* skip */ }
        }
      }

      if (!gotProjects) setRound(prev => prev + 1);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => {
        const u = [...prev];
        const l = u[u.length - 1];
        if (l?.role === 'assistant') u[u.length - 1] = { ...l, content: '⚠️ 网络请求失败，请点击重新发送。', failed: true };
        return u;
      });
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  }, [messages]);

  // Phase 1: 确认分类
  const handleCategoryConfirm = useCallback(() => {
    if (!selectedCategory) return;
    setCategoryConfirmed(true);
    setRound(1);
    streamRequest(
      `我对 ${selectedCategory} 方向感兴趣，请引导我深入了解`,
      selectedCategory,
    );
  }, [selectedCategory, streamRequest]);

  // 选择选项或自由输入
  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    streamRequest(text.trim(), selectedCategory || undefined);
  }, [isStreaming, streamRequest, selectedCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // 分类表格
  const categoryOptions = categories.map(c => ({
    label: c.label,
    description: c.description,
    emoji: c.emoji,
    badge: `${c.projectCount} 项目`,
  }));
  const aiOptionItems = aiOptions.map(opt => ({ label: opt }));

  // 是否已经推荐了项目（进入深入问答模式）
  const inDeepDive = hasProjects;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 返回 + 标题 */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/projects" className="glass-btn-outline px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> 返回
        </Link>
        <div>
          <h1 className="text-2xl font-bold klein-gradient-text">引导探索</h1>
          <p className="text-xs text-text-dim">
            {inDeepDive ? '项目已推荐 · 继续追问深入了解' : '深度对话 · 个体化推荐'}
          </p>
        </div>
      </div>

      {/* 动态 Phase Tracker */}
      <div className="glass p-4 mb-6">
        <div className="flex items-center gap-1 flex-wrap">
          {phases.filter(p => p.id <= Math.max(round + 1, 2)).map((phase, idx, arr) => (
            <div key={phase.id} className="flex items-center gap-1.5">
              {idx > 0 && <div className="w-4 h-[2px] bg-border shrink-0" />}
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all duration-300 ${
                phase.status === 'completed'
                  ? 'bg-klein/15 text-klein-light border border-klein/30'
                  : phase.status === 'active'
                    ? 'bg-klein/20 text-klein-light border border-klein/40 shadow-sm shadow-klein/10'
                    : 'bg-bg-card text-text-dim border border-border'
              }`}>
                <span>{phase.status === 'completed' ? '✓' : phase.status === 'active' ? '●' : '○'}</span>
                <span className="font-medium">{phase.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 内容区 — 占满页面 */}
      <div
        ref={scrollRef}
        className="space-y-4 overflow-y-auto pr-1 mb-4"
        style={{ height: 'calc(100vh - 340px)', minHeight: '400px' }}
      >
        {/* Phase 1: 分类选择 */}
        {!categoryConfirmed && (
          <div className="glass p-5">
            <h3 className="text-sm font-medium text-text-muted mb-3 uppercase tracking-widest">
              选择你感兴趣的方向
            </h3>
            <OptionTable
              options={categoryOptions}
              selectedValue={selectedCategory}
              onSelect={setSelectedCategory}
            />
            {selectedCategory && (
              <button
                onClick={handleCategoryConfirm}
                className="glass-btn mt-4 px-6 py-2.5 text-sm inline-flex items-center gap-2"
              >
                开始探索 →
              </button>
            )}
          </div>
        )}

        {/* 消息列表 */}
        {messages.map((msg, idx) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
            onRetry={msg.failed ? () => {
              // 移除失败的用户消息和助手错误消息，然后重发
              const prevUserMsg = messages[idx - 1];
              setMessages(prev => prev.slice(0, idx - 1));
              if (prevUserMsg?.role === 'user') {
                setTimeout(() => handleSend(prevUserMsg.content), 50);
              }
            } : undefined}
          />
        ))}

        {/* Thinking */}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && (
          <div className="flex items-center gap-2 py-3">
            <span className="thinking-dot" style={{ animationDelay: '0s' }} />
            <span className="thinking-dot" style={{ animationDelay: '0.2s' }} />
            <span className="thinking-dot" style={{ animationDelay: '0.4s' }} />
            <span className="text-xs text-text-dim ml-1">思考中</span>
          </div>
        )}

        {/* AI 生成的选项（只在还没推荐项目时显示） */}
        {categoryConfirmed && !inDeepDive && aiOptions.length > 0 && !isStreaming && (
          <div className="glass p-5">
            <span className="text-xs font-medium text-text-muted uppercase tracking-widest mb-3 block">
              选择最符合你的情况
            </span>
            <OptionTable
              options={aiOptionItems}
              onSelect={handleSend}
            />
          </div>
        )}
      </div>

      {/* 输入区 */}
      {categoryConfirmed && !isStreaming && (
        <>
          {/* 建议按钮 */}
          <form onSubmit={handleSubmit} className="glass p-2 flex items-center gap-2 mt-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={inDeepDive ? '追问项目细节、对比、使用场景...' : '也可以用自己的话描述...'}
              className="flex-1 bg-transparent border-none outline-none text-text text-sm placeholder:text-text-dim px-3 py-2"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="glass-btn p-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="发送"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
