import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const RECORDS_ROOT = path.join(process.cwd(), 'content', 'records');

export interface RecordMeta {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  cover?: string;
  featured: boolean;
}

export interface RecordDocument extends RecordMeta {
  content: string;
}

function findMarkdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findMarkdownFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('_')) return [];
    return [absolutePath];
  });
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseRecord(filePath: string): RecordDocument | null {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const date = normalizeDate(data.date);

  if (!title || !date || data.draft === true) return null;

  const relativePath = path.relative(RECORDS_ROOT, filePath).replaceAll(path.sep, '/');
  const slug = relativePath.replace(/\.md$/, '');
  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      .map((tag) => tag.trim())
    : [];

  return {
    slug,
    title,
    date,
    summary,
    tags,
    cover: typeof data.cover === 'string' && data.cover.trim() ? data.cover.trim() : undefined,
    featured: data.featured === true,
    content: content.trim(),
  };
}

export function getAllRecords(): RecordDocument[] {
  return findMarkdownFiles(RECORDS_ROOT)
    .map(parseRecord)
    .filter((record): record is RecordDocument => record !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getRecordBySlug(slugParts: string[]): RecordDocument | null {
  const slug = slugParts.join('/');
  if (!slug || slugParts.some((part) => !part || part === '.' || part === '..')) return null;
  return getAllRecords().find((record) => record.slug === slug) ?? null;
}

export function formatRecordDate(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00+08:00`));
}
