import { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import NoteLayout from '@/components/NoteLayout';
import { getNoteBySlug, getAllSlugs, getSidebarTree, getAttachmentByPath, getAttachmentSlugs } from '@/lib/notes';
import { ArrowLeft, FileCode, File } from 'lucide-react';
import Link from 'next/link';

export const dynamicParams = true;

export function generateStaticParams() {
  const noteSlugs = getAllSlugs().map((slug) => ({ slug }));
  const attachSlugs = getAttachmentSlugs().map((slug) => ({ slug }));
  return [...noteSlugs, ...attachSlugs];
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  return params.then(({ slug }) => {
    if (slug[0] === 'attachments') {
      return { title: `${decodeURIComponent(slug[slug.length - 1])} | Flacko的取景框` };
    }
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
  const sidebarTree = getSidebarTree();
  const currentPath = `/notes/${slug.join('/')}`;

  // ── 附件路由 ──
  if (slug[0] === 'attachments' && slug.length >= 3) {
    const dirName = slug[1];
    const fileName = decodeURIComponent(slug[2]);
    const attachment = getAttachmentByPath(dirName, fileName);

    if (!attachment) {
      return (
        <NoteLayout sidebarTree={sidebarTree} currentPath={currentPath}>
          <div className="max-w-4xl text-center text-text-dim py-12">
            <p className="text-lg mb-4">附件未找到</p>
            <Link href="/notes" className="text-accent hover:underline">← 返回笔记列表</Link>
          </div>
        </NoteLayout>
      );
    }

    return (
      <NoteLayout sidebarTree={sidebarTree} currentPath={currentPath}>
        <article className="max-w-4xl">
          <Link
            href="/notes"
            className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-accent transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回列表
          </Link>

          {/* Markdown 附件 — 和笔记完全一样渲染 */}
          {attachment.type === 'markdown' && (
            <>
              <h1 className="text-3xl font-bold text-text mb-8">{attachment.title}</h1>
              <div className="prose-notes">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight, rehypeSlug]}
                >
                  {attachment.content}
                </ReactMarkdown>
              </div>
            </>
          )}

          {/* 代码/文本附件 — 语法高亮 */}
          {attachment.type === 'code' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <FileCode className="w-5 h-5 text-accent/60" />
                <h1 className="text-2xl font-bold text-text">{attachment.fileName}</h1>
                <span className="tag text-xs">{attachment.language}</span>
              </div>
              <div className="prose-notes">
                <pre className="!rounded-xl !border !border-white/[0.06]">
                  <code className={`language-${attachment.language}`}>
                    {attachment.content}
                  </code>
                </pre>
              </div>
            </>
          )}

          {/* 图片/PDF 等文件 — 内联显示 */}
          {attachment.type === 'file' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <File className="w-5 h-5 text-accent/60" />
                <h1 className="text-2xl font-bold text-text">{attachment.fileName}</h1>
              </div>
              {['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(attachment.ext) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/notes-attachments/${dirName}/${encodeURIComponent(attachment.fileName)}`}
                  alt={attachment.fileName}
                  className="rounded-xl max-w-full"
                />
              ) : attachment.ext === '.pdf' ? (
                <iframe
                  src={`/notes-attachments/${dirName}/${encodeURIComponent(attachment.fileName)}`}
                  className="w-full h-[80vh] rounded-xl border border-white/10"
                  title={attachment.fileName}
                />
              ) : (
                <p className="text-text-dim">此文件类型不支持预览，请
                  <a
                    href={`/notes-attachments/${dirName}/${encodeURIComponent(attachment.fileName)}`}
                    className="text-accent hover:underline"
                  >下载查看</a>
                </p>
              )}
            </>
          )}
        </article>
      </NoteLayout>
    );
  }

  // ── 笔记路由（原有逻辑） ──
  const note = getNoteBySlug(slug);

  if (!note) {
    return (
      <NoteLayout sidebarTree={sidebarTree} currentPath={currentPath}>
        <div className="max-w-4xl text-center text-text-dim py-12">
          <p className="text-lg mb-4">笔记未找到</p>
          <Link href="/notes" className="text-accent hover:underline">← 返回笔记列表</Link>
        </div>
      </NoteLayout>
    );
  }

  return (
    <NoteLayout sidebarTree={sidebarTree} currentPath={currentPath}>
      <article className="max-w-4xl">
        {/* 返回 + 标题 */}
        <Link
          href="/notes"
          className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回列表
        </Link>

        <h1 className="text-3xl font-bold text-text mb-2">{note.title}</h1>
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-8">
            {note.tags.map((tag) => (
              <span key={tag} className="tag text-xs">{tag}</span>
            ))}
          </div>
        )}

        {/* Markdown 内容 — rehypeSlug 给 h1/h2/h3 加 id，供 TOC 跳转 */}
        <div className="prose-notes">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeSlug]}
          >
            {note.content}
          </ReactMarkdown>
        </div>
      </article>
    </NoteLayout>
  );
}
