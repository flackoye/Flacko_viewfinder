'use client';

import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

const categories = [
  { key: 'all', label: '全部' },
  { key: 'transformer', label: 'Transformer' },
  { key: 'project', label: '项目笔记' },
];

/* 笔记数据 — 后续从 Markdown 读取 */
const notes: {
  title: string;
  desc: string;
  category: string;
  tags: string[];
  date: string;
  href: string;
}[] = [];

export default function NotesPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = notes.filter((note) => {
    const matchCategory = activeCategory === 'all' || note.category === activeCategory;
    const matchSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">
          <span className="gradient-text">笔记</span>
        </h1>
        <p className="text-text-muted">学习过程中的思考、推导和理解记录</p>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
        <input
          type="text"
          placeholder="搜索笔记..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl glass !rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-accent/30 text-text placeholder:text-text-dim"
        />
      </div>

      {/* 分类标签 */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-1.5 rounded-full text-sm transition-all duration-200 ${
              activeCategory === cat.key
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'bg-white/[0.03] border border-white/[0.08] text-text-muted hover:border-white/[0.15] hover:text-text'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 空状态 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-text-dim">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">还没有笔记</p>
          <p className="text-sm">内容正在路上…</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((note) => (
            <div key={note.title} className="glass p-6 flex flex-col md:flex-row md:items-center gap-4 group hover-lift cursor-pointer">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-text mb-1 group-hover:text-accent transition-colors">
                  {note.title}
                </h3>
                <p className="text-sm text-text-muted line-clamp-2">{note.desc}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 md:w-48 shrink-0">
                {note.tags.map((tag) => (
                  <span key={tag} className="tag text-[11px]">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
