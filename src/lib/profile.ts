import fs from 'fs';
import path from 'path';

export interface ProfileLink {
  label: string;
  href: string;
}

export interface ProfileBookmark extends ProfileLink {
  description?: string;
}

export interface ProfileCompetition {
  title: string;
  date: string;
  award?: string;
  image: string;
  description?: string;
}

export interface ProfileGithubProject {
  name: string;
  description: string;
  href: string;
}

export interface ProfileData {
  displayName: string;
  avatar: string;
  school: string;
  major: string;
  stage: string;
  intro: string;
  motto: string;
  links: ProfileLink[];
  bookmarks: ProfileBookmark[];
  competitions: ProfileCompetition[];
  githubProjects: ProfileGithubProject[];
}

const fallbackProfile: ProfileData = {
  displayName: 'Cuhk_Chasing',
  avatar: '/avatar.jpg',
  school: 'CUMT',
  major: 'CS',
  stage: '大三在读',
  intro: '',
  motto: '上坡要努力，下坡要开心',
  links: [],
  bookmarks: [],
  competitions: [],
  githubProjects: [],
};

function parseLinks(value: unknown): ProfileLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.label !== 'string' || typeof candidate.href !== 'string') return [];
    return [{ label: candidate.label, href: candidate.href }];
  });
}

function parseBookmarks(value: unknown): ProfileBookmark[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.label !== 'string' || typeof candidate.href !== 'string') return [];
    return [{
      label: candidate.label,
      href: candidate.href,
      description: typeof candidate.description === 'string' ? candidate.description : undefined,
    }];
  });
}

function parseCompetitions(value: unknown): ProfileCompetition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (candidate.draft === true) return [];
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const date = typeof candidate.date === 'string' ? candidate.date.trim() : '';
    const award = typeof candidate.award === 'string' ? candidate.award.trim() : '';
    const image = typeof candidate.image === 'string' ? candidate.image.trim() : '';
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !image) return [];
    return [{
      title,
      date,
      award: award || undefined,
      image,
      description: typeof candidate.description === 'string' && candidate.description.trim()
        ? candidate.description.trim()
        : undefined,
    }];
  });
}

function parseGithubProjects(value: unknown): ProfileGithubProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (candidate.draft === true) return [];
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const description = typeof candidate.description === 'string' ? candidate.description.trim() : '';
    const href = typeof candidate.href === 'string' ? candidate.href.trim() : '';
    if (!name || !description || !href) return [];
    return [{ name, description, href }];
  });
}

export function getProfile(): ProfileData {
  try {
    const filePath = path.join(process.cwd(), 'content', 'profile.json');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    const text = (key: keyof ProfileData, fallback: string) => (
      typeof parsed[key] === 'string' ? String(parsed[key]).trim() : fallback
    );

    return {
      displayName: text('displayName', fallbackProfile.displayName),
      avatar: text('avatar', fallbackProfile.avatar),
      school: text('school', fallbackProfile.school),
      major: text('major', fallbackProfile.major),
      stage: text('stage', fallbackProfile.stage),
      intro: text('intro', ''),
      motto: text('motto', fallbackProfile.motto),
      links: parseLinks(parsed.links),
      bookmarks: parseBookmarks(parsed.bookmarks),
      competitions: parseCompetitions(parsed.competitions),
      githubProjects: parseGithubProjects(parsed.githubProjects),
    };
  } catch {
    return fallbackProfile;
  }
}
