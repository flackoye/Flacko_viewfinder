'use client';

import type { Heading } from '@/lib/notes';

interface NotesTocProps {
  headings: Heading[];
}

export default function NotesToc({ headings }: NotesTocProps) {
  return (
    <nav className="space-y-0.5">
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className="block text-sm text-text-muted hover:text-accent transition-colors truncate"
          style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
          title={h.text}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}
