'use client';

import { useState } from 'react';
import Image from 'next/image';
import { GraduationCap, MapPin, RefreshCw } from 'lucide-react';
import { fetchQuote, type Quote } from '@/lib/quotes';
import { useSettings } from '@/components/SettingsProvider';
import PetCharacter from '@/components/PetCharacter';
import Customizer from '@/components/Customizer';
import CameraDirectoryDial from '@/components/CameraDirectoryDial';
import SectionRail from '@/components/SectionRail';
import WritingShowcase, { type HomeRecord } from '@/components/WritingShowcase';

export type { HomeRecord } from '@/components/WritingShowcase';

interface HomeContentProps {
  initialQuote: Quote;
  records: HomeRecord[];
  profile: HomeProfile;
}

export interface HomeProfile {
  displayName: string;
  avatar: string;
  school: string;
  major: string;
  stage: string;
}

export default function HomeContent({ initialQuote, records, profile }: HomeContentProps) {
  const [quote, setQuote] = useState(initialQuote);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();

  const handleNewQuote = async () => {
    setLoading(true);
    try {
      setQuote(await fetchQuote());
    } finally {
      setLoading(false);
    }
  };

  const sourceText = [quote.author, quote.from].filter(Boolean).join(' / ');
  const quoteLength = Array.from(quote.text).length;
  const quoteTextClass = quoteLength > 90
    ? 'text-sm leading-6 md:text-base md:leading-7'
    : quoteLength > 52
      ? 'text-base leading-7 md:text-lg md:leading-8'
      : quoteLength > 28
        ? 'text-lg leading-8 md:text-xl md:leading-9'
        : 'text-xl leading-9 md:text-2xl md:leading-10';

  return (
    <>
      <PetCharacter />
      <Customizer />

      <section className="home-portrait relative min-h-[calc(100svh-4rem)] overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={settings.backgroundImage}
            alt="首页背景"
            fill
            className="object-cover"
            style={{
              objectPosition: 'center 35%',
              filter: `brightness(${settings.brightness / 100})`,
            }}
            priority
          />
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: settings.overlayOpacity / 220 }}
          />
          <div className="home-portrait__scrim absolute inset-0" />
        </div>

        <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-7xl items-end gap-14 px-6 pb-16 pt-28 md:grid-cols-[minmax(0,0.9fr)_minmax(380px,1fr)] md:px-10 md:pb-20 lg:px-14">
          <div className="max-w-2xl">
            <div className="mb-7 flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-white/25 md:h-20 md:w-20">
                <Image
                  src={profile.avatar}
                  alt={profile.displayName}
                  fill
                  sizes="80px"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/[0.7] md:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {profile.school} · {profile.major}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> {profile.stage}
                </span>
              </div>
            </div>

            <h1 className="text-4xl font-semibold tracking-[-0.045em] text-white drop-shadow-lg sm:text-5xl md:text-7xl lg:text-8xl">
              {profile.displayName}
            </h1>

            <CameraDirectoryDial />
          </div>

          <figure className="home-quote-caption self-end">
            <div className="home-quote-caption__header">
              <figcaption>每日一言</figcaption>
              <button
                onClick={handleNewQuote}
                disabled={loading}
                className="home-quote-caption__refresh"
                aria-label="换一句每日一言"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '获取中' : '换一句'}
              </button>
            </div>
            <blockquote key={quote.text} className="home-quote-caption__body">
              <span className="home-quote-caption__mark" aria-hidden>“</span>
              <div className="min-w-0">
                <p className={`home-quote-caption__text ${quoteTextClass}`}>{quote.text}</p>
                {sourceText && <cite>— {sourceText}</cite>}
              </div>
            </blockquote>
          </figure>
        </div>
      </section>

      <WritingShowcase records={records} />
      <SectionRail />
    </>
  );
}
