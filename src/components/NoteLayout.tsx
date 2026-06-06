'use client';

import { useState } from 'react';
import { PanelLeft } from 'lucide-react';
import SidebarTree from './NotesToc';
import type { SidebarBranch } from '@/lib/notes';

interface NoteLayoutProps {
  sidebarTree: SidebarBranch[];
  children: React.ReactNode;
}

export default function NoteLayout({ sidebarTree, children }: NoteLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] relative">
      {/* ── 左侧侧栏（桌面端 sticky，移动端抽屉） ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 glass-nav border-r border-white/5 pt-20 pb-6 px-3 overflow-y-auto transition-transform duration-300 md:sticky md:top-16 md:pt-6 md:translate-x-0 md:shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
      >
        <div className="px-2 mb-3">
          <span className="text-xs font-medium text-text-dim uppercase tracking-widest">目录</span>
        </div>

        {sidebarTree.length > 0 ? (
          <SidebarTree branches={sidebarTree} />
        ) : (
          <p className="text-xs text-text-dim px-2">暂无内容</p>
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
      <main className="flex-1 min-w-0 px-6 md:px-10 py-8">
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
