'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, Paperclip } from 'lucide-react';
import type { SidebarBranch } from '@/lib/notes';

interface SidebarTreeProps {
  branches: SidebarBranch[];
  currentPath?: string;   // 当前页面路径，如 "/notes/Transformer/Transformer_Learning"
}

export default function SidebarTree({ branches, currentPath }: SidebarTreeProps) {
  return (
    <nav className="space-y-1">
      {branches.map((branch) => (
        <BranchItem key={branch.name} branch={branch} currentPath={currentPath} />
      ))}
    </nav>
  );
}

function BranchItem({ branch, currentPath }: { branch: SidebarBranch; currentPath?: string }) {
  const [expanded, setExpanded] = useState(true);
  const isAttachment = branch.name.toLowerCase() === 'attachment';
  const Icon = isAttachment ? Paperclip : Folder;

  /** 点击侧栏子项：hash 跳转用 scrollIntoView，全路径用 window.open */
  const handleChildClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // 判断是否为同页面的 hash 锚点
    const isSamePageHash = currentPath && href.startsWith(currentPath + '#');
    if (isSamePageHash) {
      e.preventDefault();
      const hash = href.slice(currentPath.length + 1); // 去掉 "/notes/...#" → 取 "fun-transformer"
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 更新 URL hash 但不触发跳转
        history.replaceState(null, '', `#${hash}`);
      }
    }
  }, [currentPath]);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm font-medium text-text-muted hover:text-text hover:bg-white/5 rounded-lg transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-dim" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-dim" />
        )}
        <Icon className="w-3.5 h-3.5 shrink-0 text-accent/60" />
        <span className="truncate">{branch.name}</span>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {branch.children.map((child, i) => (
            <a
              key={i}
              href={child.href}
              onClick={(e) => handleChildClick(e, child.href)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-text-dim hover:text-accent transition-colors rounded-lg hover:bg-white/[0.03]"
              style={{ paddingLeft: '28px' }}
              title={child.label}
            >
              <FileText className="w-3 h-3 shrink-0 opacity-40" />
              <span className="truncate">{child.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
