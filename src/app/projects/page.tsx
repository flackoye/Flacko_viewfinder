import { FolderGit2 } from 'lucide-react';

/* 项目数据 — 后续从 Markdown 读取 */
const projects: {
  title: string;
  desc: string;
  tags: string[];
  github?: string;
  status: string;
}[] = [];

export default function ProjectsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-3">
          <span className="gradient-text">项目</span>
        </h1>
        <p className="text-text-muted">动手做的项目，从想法到实现</p>
      </div>

      {/* 空状态 */}
      {projects.length === 0 ? (
        <div className="text-center py-20 text-text-dim">
          <FolderGit2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg mb-2">还没有项目</p>
          <p className="text-sm">项目正在路上…</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {projects.map((project) => (
            <div key={project.title} className="glass overflow-hidden group hover-lift">
              <div className="h-0.5 bg-gradient-to-r from-accent/60 to-accent-light/60" />
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-text group-hover:text-accent transition-colors">
                    {project.title}
                  </h3>
                  <span className="px-2.5 py-0.5 text-xs rounded-full bg-accent/10 text-accent border border-accent/15 shrink-0">
                    {project.status}
                  </span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed mb-4">{project.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="tag text-[11px]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
