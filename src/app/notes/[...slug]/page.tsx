import { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import NoteLayout from '@/components/NoteLayout';
import { getNotesTree, getNoteBySlug, getAllSlugs } from '@/lib/notes';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamicParams = true;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  // async — Next.js 16 要求 params 是 Promise
  return params.then(({ slug }) => {
    const note = getNoteBySlug(slug);
    return {
      title: note ? `${note.title} | Flacko的取景框` : '笔记未找到',
    };
  });
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const tree = getNotesTree();
  const note = getNoteBySlug(slug);

  if (!note) {
    return (
      <NoteLayout tree={tree} activeSlug={slug}>
        <div className="text-center py-20 text-text-dim">
          <p className="text-lg mb-4">笔记未找到</p>
          <Link href="/notes" className="text-accent hover:underline">
            ← 返回笔记列表
          </Link>
        </div>
      </NoteLayout>
    );
  }

  return (
    <NoteLayout tree={tree} activeSlug={slug}>
      <article className="max-w-3xl">
        {/* 返回 + 标题 */}
        <Link
          href="/notes"
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回列表
        </Link>

        <h1 className="text-3xl font-bold text-text mb-2">{note.title}</h1>
        {note.date && (
          <p className="text-sm text-text-dim mb-8">{note.date}</p>
        )}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-8">
            {note.tags.map((tag) => (
              <span key={tag} className="tag text-xs">{tag}</span>
            ))}
          </div>
        )}

        {/* Markdown 内容 */}
        <div className="prose-notes">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {note.content}
          </ReactMarkdown>
        </div>
      </article>
    </NoteLayout>
  );
}
