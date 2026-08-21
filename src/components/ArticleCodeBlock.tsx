'use client';

import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

function getText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return getText(node.props.children);
  return '';
}

function getLanguage(children: ReactNode): string {
  const child = Children.toArray(children).find(isValidElement);
  if (!child || !isValidElement<{ className?: string }>(child)) return 'text';
  return child.props.className?.match(/language-([\w-]+)/)?.[1] ?? 'text';
}

export default function ArticleCodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = getLanguage(children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText(children).replace(/\n$/, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="article-code-block">
      <div className="article-code-block__bar">
        <span>{language}</span>
        <button type="button" onClick={copy} aria-label="复制代码">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}
