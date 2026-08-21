import type { Metadata } from 'next';
import PageBackdrop from '@/components/PageBackdrop';
import RecordArchiveList from '@/components/RecordArchiveList';
import { getAllRecords } from '@/lib/records';

export const metadata: Metadata = {
  title: '文章 | Flacko的取景框',
  description: 'Cuhk_Chasing 写下的经历与想法',
};

export default function RecordsPage() {
  const records = getAllRecords();
  const archiveRecords = records.map((record) => ({
    slug: record.slug,
    title: record.title,
    date: record.date,
    summary: record.summary,
    tags: record.tags,
  }));

  return (
    <div className="relative isolate min-h-[calc(100vh-10rem)] overflow-hidden">
      <PageBackdrop variant="archive" />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 md:px-10 md:py-24">
        <header className="record-archive-header">
          <div>
            <span className="record-archive-header__eyebrow">Cuhk_Chasing / 文字档案</span>
            <h1>文章</h1>
          </div>
          <span className="record-archive-header__count">{String(records.length).padStart(2, '0')} 篇</span>
        </header>

        {records.length === 0 ? (
          <p className="py-16 text-text-muted">还没有公开的文章。</p>
        ) : (
          <RecordArchiveList records={archiveRecords} />
        )}
      </div>
    </div>
  );
}
