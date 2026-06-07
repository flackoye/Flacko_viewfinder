import { Star, ExternalLink, Code2 } from 'lucide-react';
import type { Project } from '@/lib/project-types';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <a
      href={project.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass block overflow-hidden hover-lift group relative"
    >
      {/* 顶部渐变条 */}
      <div className="h-1 bg-gradient-to-r from-klein via-accent to-accent-light" />

      <div className="p-5">
        {/* 分类标签 */}
        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-klein/15 text-klein-light mb-3">
          {project.category}
        </span>

        {/* 名称 + Stars */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-text group-hover:text-accent transition-colors leading-snug text-sm">
            {project.full_name}
          </h4>
          <div className="flex items-center gap-1 text-accent shrink-0">
            <Star className="w-3.5 h-3.5 fill-accent/40" />
            <span className="text-xs font-mono">{formatStars(project.stars)}</span>
          </div>
        </div>

        {/* 描述 */}
        <p className="text-xs text-text-muted leading-relaxed line-clamp-3 mb-4">
          {project.description || '暂无描述'}
        </p>

        {/* 底部：标签 + 外链 */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
          <div className="flex items-center gap-2 flex-wrap">
            {project.language && (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                <Code2 className="w-3 h-3" />
                {project.language}
              </span>
            )}
            {project.topics?.slice(0, 2).map(topic => (
              <span key={topic} className="tag text-[10px]">{topic}</span>
            ))}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-text-dim group-hover:text-accent transition-colors shrink-0" />
        </div>
      </div>
    </a>
  );
}
