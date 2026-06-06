'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import type { TreeNode } from '@/lib/notes';

interface NotesTreeProps {
  tree: TreeNode[];
  activeSlug?: string[];
}

export default function NotesTree({ tree, activeSlug }: NotesTreeProps) {
  return (
    <nav className="space-y-0.5">
      {tree.map((node) => (
        <TreeNodeItem
          key={node.name}
          node={node}
          activeSlug={activeSlug}
          depth={0}
        />
      ))}
    </nav>
  );
}

function TreeNodeItem({
  node,
  activeSlug,
  depth,
}: {
  node: TreeNode;
  activeSlug?: string[];
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-sm text-text-muted hover:text-text hover:bg-white/5 rounded-lg transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-dim" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-dim" />
          )}
          <Folder className="w-3.5 h-3.5 shrink-0 text-accent/60" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.name}
                node={child}
                activeSlug={activeSlug}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 文件节点
  const href = `/notes/${node.slug.join('/')}`;
  const isActive = activeSlug
    ? node.slug.join('/') === activeSlug.join('/')
    : false;

  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg transition-colors ${
        isActive
          ? 'text-accent bg-accent/10'
          : 'text-text-muted hover:text-text hover:bg-white/5'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-accent' : 'text-text-dim'}`} />
      <span className="truncate">{node.title}</span>
    </Link>
  );
}
