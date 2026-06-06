/**
 * 附件 Route Handler — 强制内联显示而非下载
 *
 * Next.js 从 public/ 托管 .py 等文件时，MIME 类型可能是
 * application/octet-stream，浏览器识别不了就会触发下载。
 * 这个 Route Handler 拦截 /notes-attachments/* 请求，
 * 手动设置正确的 Content-Type + Content-Disposition: inline。
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ATTACHMENTS_DIR = path.join(process.cwd(), 'public', 'notes-attachments');

/** 扩展名 → Content-Type 映射 */
const MIME_MAP: Record<string, string> = {
  // 代码 / 文本
  '.py':   'text/plain; charset=utf-8',
  '.js':   'text/plain; charset=utf-8',
  '.ts':   'text/plain; charset=utf-8',
  '.jsx':  'text/plain; charset=utf-8',
  '.tsx':  'text/plain; charset=utf-8',
  '.css':  'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.xml':  'text/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8',
  '.yml':  'text/plain; charset=utf-8',
  '.md':   'text/plain; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.log':  'text/plain; charset=utf-8',
  '.sh':   'text/plain; charset=utf-8',
  // 图片
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  // 文档
  '.pdf':  'application/pdf',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await params;
  const filePath = path.join(ATTACHMENTS_DIR, ...pathParts);

  // 安全检查：防止路径遍历
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(ATTACHMENTS_DIR))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const content = fs.readFileSync(resolved);

  return new NextResponse(content, {
    headers: {
      'Content-Type': contentType,
      // inline = 浏览器尽量内联显示，而非下载
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
