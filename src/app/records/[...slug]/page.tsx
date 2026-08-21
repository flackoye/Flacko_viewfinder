import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import RecordArticle from '@/components/RecordArticle';
import { formatRecordDate, getAllRecords, getRecordBySlug } from '@/lib/records';

interface RecordPageProps {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  return getAllRecords().map((record) => ({ slug: record.slug.split('/') }));
}

export async function generateMetadata({ params }: RecordPageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = getRecordBySlug(slug);
  if (!record) return {};

  return {
    title: `${record.title} | Flacko的取景框`,
    description: record.summary || record.title,
  };
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { slug } = await params;
  const record = getRecordBySlug(slug);
  if (!record) notFound();

  return (
    <article className="mx-auto w-full max-w-5xl px-6 py-14 md:py-20">
      <Link href="/records" className="home-inline-link text-text-muted">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回文章
      </Link>

      <header className="mx-auto mt-12 max-w-3xl border-b border-white/10 pb-10">
        <time className="font-mono text-xs text-text-dim">{formatRecordDate(record.date)}</time>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          {record.title}
        </h1>
        {record.summary && (
          <p className="mt-5 text-base leading-8 text-text-muted md:text-lg">{record.summary}</p>
        )}
        {record.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-x-3 gap-y-2">
            {record.tags.map((tag) => (
              <span key={tag} className="text-xs text-text-dim">#{tag}</span>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto mt-12 max-w-3xl">
        <RecordArticle content={record.content} />
      </div>
    </article>
  );
}
