'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, Paperclip } from 'lucide-react';
import type { SidebarBranch } from '@/lib/notes';

interface SidebarTreeProps {
  branches: SidebarBranch[];
}

export default function SidebarTree({ branches }: SidebarTreeProps) {
  return (
    <nav className="space-y-1">
      {branches.map((branch) => (
        <BranchItem key={branch.name} branch={branch} />
      ))}
    </nav>
  );
}

function BranchItem({ branch }: { branch: SidebarBranch }) {
  const [expanded, setExpanded] = useState(true);
  const isAttachment = branch.name.toLowerCase() === 'attachment';
  const Icon = isAttachment ? Paperclip : Folder;

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
