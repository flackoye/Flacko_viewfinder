import { fetchQuote } from '@/lib/quotes';
import HomeContent, { type HomeProfile, type HomeRecord } from '@/components/HomeContent';
import { getAllRecords } from '@/lib/records';
import { getProfile } from '@/lib/profile';

function getHomeRecords(): HomeRecord[] {
  return getAllRecords().slice(0, 9).map((record) => ({
    slug: record.slug,
    date: record.date,
    title: record.title,
    excerpt: record.summary,
    tags: record.tags,
  }));
}

export default async function Home() {
  const initialQuote = await fetchQuote();
  const profile = getProfile();
  const homeProfile: HomeProfile = {
    displayName: profile.displayName,
    avatar: profile.avatar,
    school: profile.school,
    major: profile.major,
    stage: profile.stage,
  };

  return <HomeContent initialQuote={initialQuote} records={getHomeRecords()} profile={homeProfile} />;
}
