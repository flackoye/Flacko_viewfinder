import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, GraduationCap, MapPin } from 'lucide-react';
import ProfileCardGallery from '@/components/ProfileCardGallery';
import PageBackdrop from '@/components/PageBackdrop';
import ScrollReveal from '@/components/ScrollReveal';
import { formatRecordDate, getAllRecords } from '@/lib/records';
import { getProfile } from '@/lib/profile';

export const metadata: Metadata = {
  title: '档案 | Flacko的取景框',
  description: 'Cuhk_Chasing 的个人档案',
};

export default function AboutPage() {
  const profile = getProfile();
  const featuredRecords = getAllRecords().filter((record) => record.featured);

  return (
    <div className="relative isolate min-h-[calc(100vh-10rem)] overflow-hidden">
      <PageBackdrop variant="profile" />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16 md:py-24">
        <ScrollReveal>
          <header className="flex flex-col items-start gap-7 border-b border-white/10 pb-12 md:flex-row md:items-end md:gap-10">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 md:h-36 md:w-36">
              <Image
                src={profile.avatar}
                alt={profile.displayName}
                fill
                sizes="144px"
                className="object-cover"
                priority
              />
            </div>

            <div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{profile.displayName}</h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {profile.school} · {profile.major}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> {profile.stage}
                </span>
              </div>
              {profile.intro && (
                <p className="mt-6 max-w-2xl text-base leading-8 text-text-muted md:text-lg">{profile.intro}</p>
              )}
            </div>
          </header>
        </ScrollReveal>

        {featuredRecords.length > 0 && (
          <ScrollReveal delay={80}>
            <section className="py-16" aria-labelledby="experience-title">
              <div className="mb-9 flex items-end justify-between gap-5">
                <h2 id="experience-title" className="text-3xl font-semibold tracking-tight">经历</h2>
                <Link href="/records" className="home-inline-link text-text-muted">
                  全部文章 <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ol className="border-t border-white/10">
                {featuredRecords.map((record) => (
                  <li key={record.slug} className="border-b border-white/[0.08] py-8">
                    <Link href={`/records/${record.slug}`} className="group grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-8">
                      <time className="font-mono text-xs text-text-dim">{formatRecordDate(record.date)}</time>
                      <div>
                        <h3 className="text-xl font-medium transition-colors group-hover:text-accent-light md:text-2xl">
                          {record.title}
                        </h3>
                        {record.summary && (
                          <p className="mt-3 max-w-2xl text-sm leading-7 text-text-muted md:text-base">
                            {record.summary}
                          </p>
                        )}
                        {record.tags.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
                            {record.tags.map((tag) => (
                              <span key={tag} className="text-xs text-text-dim">#{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          </ScrollReveal>
        )}

        {profile.competitions.length > 0 && (
          <ScrollReveal delay={100}>
            <section className="border-t border-white/10 py-14" aria-labelledby="competitions-title">
              <h2 id="competitions-title" className="mb-7 text-2xl font-semibold">比赛经历</h2>
              <ProfileCardGallery
                eyebrow="比赛记录"
                kind="competition"
                size="large"
                items={profile.competitions.map((competition) => ({
                  label: competition.title,
                  description: competition.description,
                  image: competition.image,
                  facts: [
                    { label: '日期', value: formatRecordDate(competition.date) },
                    ...(competition.award ? [{ label: '奖项', value: competition.award }] : []),
                  ],
                }))}
              />
            </section>
          </ScrollReveal>
        )}

        {profile.githubProjects.length > 0 && (
          <ScrollReveal delay={110}>
            <section className="border-t border-white/10 py-14" aria-labelledby="github-projects-title">
              <h2 id="github-projects-title" className="mb-7 text-2xl font-semibold">GitHub 项目</h2>
              <ProfileCardGallery
                eyebrow="仓库取景"
                kind="github"
                items={profile.githubProjects.map((project) => ({
                  label: project.name,
                  description: project.description,
                  href: project.href,
                }))}
              />
            </section>
          </ScrollReveal>
        )}

        {profile.bookmarks.length > 0 && (
          <ScrollReveal delay={120}>
            <section className="border-t border-white/10 py-14" aria-labelledby="bookmarks-title">
              <h2 id="bookmarks-title" className="mb-7 text-2xl font-semibold">收藏</h2>
              <ProfileCardGallery
                eyebrow="收藏取景"
                kind="bookmark"
                items={profile.bookmarks.map((bookmark) => ({
                  label: bookmark.label,
                  description: bookmark.description,
                  href: bookmark.href,
                }))}
              />
            </section>
          </ScrollReveal>
        )}

        <ScrollReveal delay={160}>
          <footer className="flex flex-col gap-8 border-t border-white/10 pt-10 md:flex-row md:items-end md:justify-between">
            {profile.motto && (
              <blockquote className="max-w-xl text-xl leading-8 text-text-muted md:text-2xl">
                “{profile.motto}”
              </blockquote>
            )}
            {profile.links.length > 0 && (
              <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="个人链接">
                {profile.links.map((link) => {
                  const external = link.href.startsWith('http');
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noopener noreferrer' : undefined}
                      className="home-inline-link text-text-muted"
                    >
                      {link.label} <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  );
                })}
              </nav>
            )}
          </footer>
        </ScrollReveal>
      </div>
    </div>
  );
}
