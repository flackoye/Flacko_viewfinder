import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import ArticleCodeBlock from '@/components/ArticleCodeBlock';

const components: Components = {
  a({ href = '', children, ...props }) {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
  img({ src = '', alt = '', title }) {
    const imageSource = String(src);
    return (
      <span className="article-image">
        <a href={imageSource} target="_blank" rel="noopener noreferrer" aria-label={`查看原图：${alt || '文章图片'}`}>
          {/* Markdown 图片保留原始比例；本地文件由 public/records 直接提供。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSource} alt={alt} loading="lazy" decoding="async" />
        </a>
        {title && <span className="article-image__caption">{title}</span>}
      </span>
    );
  },
  pre({ children }) {
    return <ArticleCodeBlock>{children}</ArticleCodeBlock>;
  },
  table({ children }) {
    return <div className="article-table-wrap"><table>{children}</table></div>;
  },
};

export default function RecordArticle({ content }: { content: string }) {
  return (
    <div className="record-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: 'wrap' }],
          rehypeHighlight,
          rehypeKatex,
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
