import fs from 'fs';
import path from 'path';
import { Metadata } from 'next';
import ChangelogView from '@/components/ChangelogView';
import PageBackdrop from '@/components/PageBackdrop';

export const metadata: Metadata = {
  title: '更新日志 | Flacko的取景框',
  description: '记录站点的每一次进化',
};

export default function ChangelogPage() {
  const filePath = path.join(process.cwd(), 'public', 'changelog.json');

  let entries = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    entries = data.entries || [];
  } catch {
    // 文件不存在或解析失败
  }

  return (
    <div className="page-fade-in relative isolate min-h-[calc(100vh-10rem)] overflow-hidden">
      <PageBackdrop variant="archive" />
      <div className="relative z-10">
        <ChangelogView entries={entries} />
      </div>
    </div>
  );
}
