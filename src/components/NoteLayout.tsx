'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import NotesTree from './NotesTree';
import type { TreeNode } from '@/lib/notes';

interface NoteLayoutProps {
  tree: TreeNode[];
  activeSlug?: string[];
  children: React.ReactNode;
}

export default function NoteLayout({ tree, activeSlug, children }: NoteLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] relative">
      {/* ── 左侧目录树（桌面端常驻，移动端抽屉） ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 glass-nav border-r border-white/5 pt-20 pb-6 px-3 overflow-y-auto transition-transform duration-300 md:relative md:pt-0 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-2 mb-4">
          <span className="text-xs font-medium text-text-dim uppercase tracking-widest">笔记目录</span>
          {/* 移动端关闭按钮 */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 rounded text-text-dim hover:text-text"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {tree.length === 0 ? (
          <p className="text-xs text-text-dim px-2">暂无笔记</p>
        ) : (
          <NotesTree tree={tree} activeSlug={activeSlug} />
        )}
      </aside>

      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── 右侧内容区 ── */}
      <main className="flex-1 min-w-0 px-6 py-8">
        {/* 移动端打开侧栏按钮 */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden flex items-center gap-1.5 mb-4 text-sm text-text-dim hover:text-text transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
          目录
        </button>

        {children}
      </main>
    </div>
  );
}
