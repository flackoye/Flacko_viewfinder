import { ArrowUpRight, Code2, Gauge, GitFork, ScanSearch, Star } from 'lucide-react';
import type { Project } from '@/lib/project-types';

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replaceAll('/', '.');
}

export default function ProjectCard({ project }: { project: Project }) {
  const [owner, repoName = project.name] = project.full_name.split('/');
  const matchPercent = project.match_score === undefined
    ? null
    : Math.round(Math.min(1, Math.max(0, project.match_score)) * 100);

  return (
    <a
      href={project.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="project-scan-card group"
    >
      <span className="project-scan-card__beam" aria-hidden />
      <span className="project-scan-card__corner project-scan-card__corner--tl" aria-hidden />
      <span className="project-scan-card__corner project-scan-card__corner--br" aria-hidden />

      <div className="project-scan-card__body">
        <div className="project-scan-card__category">
          <GitFork aria-hidden />
          <span>{project.category}</span>
        </div>

        <div className="project-scan-card__identity">
          <span>{owner}</span>
          <h4>{repoName}</h4>
        </div>

        <p className="project-scan-card__description">
          {project.description || '暂无描述'}
        </p>

        {matchPercent !== null && (
          <div className="project-scan-card__match">
            <div>
              <span><Gauge aria-hidden /> 向量匹配度</span>
              <strong>{matchPercent}%</strong>
            </div>
            <span className="project-scan-card__match-track" aria-hidden>
              <i style={{ width: `${matchPercent}%` }} />
            </span>
          </div>
        )}

        <dl className="project-scan-card__telemetry">
          <div>
            <dt><Star aria-hidden /> 星标</dt>
            <dd>{formatStars(project.stars)}</dd>
          </div>
          <div>
            <dt><Code2 aria-hidden /> 语言</dt>
            <dd>{project.language || 'N/A'}</dd>
          </div>
          <div>
            <dt>最近更新</dt>
            <dd>{formatUpdatedAt(project.updated_at)}</dd>
          </div>
        </dl>

        {project.topics?.length > 0 && (
          <div className="project-scan-card__topics">
            {project.topics.slice(0, 3).map(topic => <span key={topic}>#{topic}</span>)}
          </div>
        )}

        {project.matched_sections && project.matched_sections.length > 0 && (
          <div className="project-scan-card__evidence">
            <span><ScanSearch aria-hidden /> 命中内容</span>
            <div>
              {project.matched_sections.map(section => <span key={section}>{section}</span>)}
            </div>
          </div>
        )}

        <footer className="project-scan-card__footer">
          <span className="project-scan-card__open">打开仓库 <ArrowUpRight aria-hidden /></span>
        </footer>
      </div>
    </a>
  );
}
