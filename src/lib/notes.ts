/**
 * 笔记系统 — 服务端工具函数
 *
 * 从 content/notes/ 目录读取 Markdown 文件，
 * 解析 frontmatter，构建目录树结构。
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const NOTES_DIR = path.join(process.cwd(), 'content', 'notes');

// ── 类型 ──

export interface NoteMeta {
  slug: string[];          // ['Transformer', 'Transformer_Learning']
  title: string;           // 来自 frontmatter，fallback 文件名
  date?: string;           // 来自 frontmatter
  tags?: string[];         // 来自 frontmatter
}

export interface NoteData extends NoteMeta {
  content: string;         // 原始 markdown 内容（不含 frontmatter）
}

export interface TreeFolder {
  name: string;
  type: 'folder';
  children: TreeNode[];
}

export interface TreeFile {
  name: string;
  slug: string[];
  type: 'file';
  title: string;
  date?: string;
}

export type TreeNode = TreeFolder | TreeFile;

// ── 工具函数 ──

/** 确保 notes 目录存在 */
function ensureDir(): boolean {
  return fs.existsSync(NOTES_DIR);
}

/** 从文件名去掉 .md/.mdx 后缀 */
function stripExt(filename: string): string {
  return filename.replace(/\.(md|mdx)$/, '');
}

/** 读取单个 md 文件的 frontmatter */
function readFrontmatter(filePath: string): NoteMeta {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  const relativePath = path.relative(NOTES_DIR, filePath);
  const slugParts = relativePath.replace(/\\/g, '/').split('/');
  slugParts[slugParts.length - 1] = stripExt(slugParts[slugParts.length - 1]);

  return {
    slug: slugParts,
    title: data.title || stripExt(path.basename(filePath)),
    date: data.date ? String(data.date) : undefined,
    tags: data.tags || undefined,
  };
}

// ── 核心函数 ──

/**
 * 递归扫描 content/notes/，返回目录树
 * 按文件名排序（文件夹优先，然后按名称）
 */
export function getNotesTree(): TreeNode[] {
  if (!ensureDir()) return [];

  function walk(dir: string, parentSlug: string[]): TreeNode[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      // 跳过隐藏文件和非 md 文件
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const childSlug = [...parentSlug, entry.name];
        const children = walk(fullPath, childSlug);
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            type: 'folder',
            children,
          });
        }
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
        const slug = [...parentSlug, stripExt(entry.name)];
        try {
          const meta = readFrontmatter(fullPath);
          nodes.push({
            name: entry.name,
            type: 'file',
            slug,
            title: meta.title,
            date: meta.date,
          });
        } catch {
          // frontmatter 解析失败，用文件名兜底
          nodes.push({
            name: entry.name,
            type: 'file',
            slug,
            title: stripExt(entry.name),
          });
        }
      }
    }

    // 排序：文件夹在前，同类型按名称排
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  return walk(NOTES_DIR, []);
}

/**
 * 根据 slug 获取单个笔记的完整内容
 */
export function getNoteBySlug(slug: string[]): NoteData | null {
  if (!ensureDir()) return null;

  // 尝试 .md 和 .mdx
  for (const ext of ['.md', '.mdx']) {
    const filePath = path.join(NOTES_DIR, ...slug) + ext;
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      return {
        slug,
        title: data.title || stripExt(slug[slug.length - 1]),
        date: data.date ? String(data.date) : undefined,
        tags: data.tags || undefined,
        content,
      };
    }
  }

  return null;
}

/**
 * 获取所有笔记的扁平列表（带 frontmatter）
 */
export function getAllNotes(): NoteMeta[] {
  const tree = getNotesTree();
  const notes: NoteMeta[] = [];

  function collect(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        notes.push({
          slug: node.slug,
          title: node.title,
          date: node.date,
        });
      } else {
        collect(node.children);
      }
    }
  }

  collect(tree);
  return notes;
}

/**
 * 为 generateStaticParams 生成所有 slug 组合
 */
export function getAllSlugs(): string[][] {
  return getAllNotes().map(n => n.slug);
}
