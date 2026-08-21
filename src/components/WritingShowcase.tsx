'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';

export interface HomeRecord {
  slug: string;
  date: string;
  title: string;
  excerpt: string;
  tags: string[];
}

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type FilmStyle = CSSProperties & {
  '--writing-x': string;
  '--writing-y': string;
};

const initialFilmStyle: FilmStyle = {
  '--writing-x': '50%',
  '--writing-y': '50%',
};

const DEVELOP_DURATION = 720;

export default function WritingShowcase({ records }: { records: HomeRecord[] }) {
  const visibleRecords = records.slice(0, 9);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [developingSlug, setDevelopingSlug] = useState<string | null>(null);
  const [developedSlug, setDevelopedSlug] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const developTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filmTrackRef = useRef<HTMLDivElement | null>(null);

  const getAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const AudioContextConstructor = window.AudioContext
      ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    audioContextRef.current = new AudioContextConstructor();
    return audioContextRef.current;
  }, []);

  const playSwitchSound = useCallback((force = false) => {
    if (!soundEnabled && !force) return;
    const context = getAudioContext();
    if (!context) return;

    void context.resume().then(() => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(680, now);
      oscillator.frequency.exponentialRampToValueAtTime(430, now + 0.04);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.012, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.052);
    });
  }, [getAudioContext, soundEnabled]);

  const playShutterSound = useCallback(() => {
    if (!soundEnabled) return;
    const context = getAudioContext();
    if (!context) return;

    void context.resume().then(() => {
      const now = context.currentTime;
      const sampleCount = Math.floor(context.sampleRate * 0.125);
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const samples = buffer.getChannelData(0);

      for (let index = 0; index < sampleCount; index += 1) {
        const time = index / context.sampleRate;
        const firstClick = Math.exp(-time * 145);
        const returnClick = time >= 0.064 ? Math.exp(-(time - 0.064) * 170) * 0.64 : 0;
        samples[index] = (Math.random() * 2 - 1) * (firstClick + returnClick);
      }

      const noise = context.createBufferSource();
      const highpass = context.createBiquadFilter();
      const peak = context.createBiquadFilter();
      const gain = context.createGain();
      noise.buffer = buffer;
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(1450, now);
      peak.type = 'peaking';
      peak.frequency.setValueAtTime(3200, now);
      peak.Q.setValueAtTime(1.4, now);
      peak.gain.setValueAtTime(5, now);
      gain.gain.setValueAtTime(0.052, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);
      noise.connect(highpass).connect(peak).connect(gain).connect(context.destination);
      noise.start(now);

      const blade = context.createOscillator();
      const bladeGain = context.createGain();
      blade.type = 'square';
      blade.frequency.setValueAtTime(2350, now);
      blade.frequency.exponentialRampToValueAtTime(920, now + 0.024);
      bladeGain.gain.setValueAtTime(0.018, now);
      bladeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
      blade.connect(bladeGain).connect(context.destination);
      blade.start(now);
      blade.stop(now + 0.03);

      const returnBlade = context.createOscillator();
      const returnGain = context.createGain();
      returnBlade.type = 'triangle';
      returnBlade.frequency.setValueAtTime(3100, now + 0.064);
      returnBlade.frequency.exponentialRampToValueAtTime(1500, now + 0.096);
      returnGain.gain.setValueAtTime(0.0001, now);
      returnGain.gain.setValueAtTime(0.014, now + 0.064);
      returnGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      returnBlade.connect(returnGain).connect(context.destination);
      returnBlade.start(now + 0.064);
      returnBlade.stop(now + 0.105);
    });
  }, [getAudioContext, soundEnabled]);

  const cancelDeveloping = useCallback((slug?: string) => {
    if (slug && developingSlug !== slug && developedSlug !== slug) return;
    if (developTimerRef.current) {
      clearTimeout(developTimerRef.current);
      developTimerRef.current = null;
    }
    setDevelopingSlug(null);
    setDevelopedSlug(null);
  }, [developedSlug, developingSlug]);

  const beginDeveloping = useCallback((slug: string) => {
    if (developingSlug === slug || developedSlug === slug) return;
    if (developTimerRef.current) clearTimeout(developTimerRef.current);
    setDevelopedSlug(null);
    setDevelopingSlug(slug);
    developTimerRef.current = setTimeout(() => {
      developTimerRef.current = null;
      setDevelopingSlug(null);
      setDevelopedSlug(slug);
      playShutterSound();
    }, DEVELOP_DURATION);
  }, [developedSlug, developingSlug, playShutterSound]);

  useEffect(() => () => {
    if (developTimerRef.current) clearTimeout(developTimerRef.current);
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  const updateFilmControls = useCallback(() => {
    const track = filmTrackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 2);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const track = filmTrackRef.current;
    if (!track) return;
    updateFilmControls();
    track.addEventListener('scroll', updateFilmControls, { passive: true });
    const observer = new ResizeObserver(updateFilmControls);
    observer.observe(track);
    return () => {
      track.removeEventListener('scroll', updateFilmControls);
      observer.disconnect();
    };
  }, [updateFilmControls, visibleRecords.length]);

  const updatePointerLight = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--writing-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    event.currentTarget.style.setProperty('--writing-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  };

  const toggleSound = () => {
    const nextValue = !soundEnabled;
    if (!nextValue) {
      playSwitchSound();
      cancelDeveloping();
    }
    setSoundEnabled(nextValue);
    if (nextValue) playSwitchSound(true);
  };

  const scrollFilm = (direction: -1 | 1) => {
    const track = filmTrackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.78, 280),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <section id="writing" className="mx-auto w-full max-w-7xl scroll-mt-24 px-6 py-16 md:px-10 md:py-24 lg:px-14">
      <h2 className="sr-only">文章</h2>
      <div className="mb-5 flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={toggleSound}
          className={`writing-sound-toggle ${soundEnabled ? 'is-active' : ''}`}
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? '关闭文章交互声音' : '开启文章交互声音'}
        >
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          声音
        </button>
        <Link href="/records" className="home-inline-link text-text-muted">
          文章归档 <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="writing-console" style={initialFilmStyle} onPointerMove={updatePointerLight}>
        <div className="writing-console__sprockets writing-console__sprockets--top" aria-hidden />
        <div className="writing-console__sprockets writing-console__sprockets--bottom" aria-hidden />
        <div className="writing-console__light" aria-hidden />
        <div className="writing-console__grain" aria-hidden />
        <div className="writing-console__status" aria-hidden>
          <span>Cuhk_Chasing / 成长记录</span>
          <span>{String(visibleRecords.length).padStart(2, '0')} FRAMES</span>
        </div>
        {visibleRecords.length > 1 && (
          <div className="writing-film-nav" aria-label="胶卷翻页">
            <button
              type="button"
              onClick={() => scrollFilm(-1)}
              disabled={!canScrollLeft}
              aria-label="查看前面的文章"
            >
              <ChevronLeft />
            </button>
            <span aria-hidden>{String(visibleRecords.length).padStart(2, '0')}</span>
            <button
              type="button"
              onClick={() => scrollFilm(1)}
              disabled={!canScrollRight}
              aria-label="查看后面的文章"
            >
              <ChevronRight />
            </button>
          </div>
        )}

        {visibleRecords.length > 0 ? (
          <div ref={filmTrackRef} className="writing-console__layout">
            {visibleRecords.map((record, index) => {
              const stateClass = developingSlug === record.slug
                ? 'is-developing'
                : developedSlug === record.slug
                  ? 'is-developed'
                  : '';

              return (
                <article
                  key={record.slug}
                  className={`writing-console__focus ${stateClass}`}
                  onPointerEnter={() => beginDeveloping(record.slug)}
                  onPointerLeave={() => cancelDeveloping(record.slug)}
                  onFocusCapture={() => beginDeveloping(record.slug)}
                  onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) cancelDeveloping(record.slug);
                  }}
                >
                  <div className="writing-console__article">
                    <div className="writing-film-tags">
                      {record.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
                    </div>
                    <div className="writing-film-meta">
                      <span>{String(index + 1).padStart(2, '0')}A</span>
                      <time>{record.date.replaceAll('-', '.')}</time>
                    </div>
                    <div className="writing-film-title-row">
                      <Link href={`/records/${record.slug}`} className="writing-open-link">
                        {record.title}
                      </Link>
                      <span className="writing-film-progress" aria-hidden>
                        {[0, 1, 2, 3].map((step) => <ChevronRight key={step} />)}
                      </span>
                    </div>
                    {record.excerpt && <p className="writing-film-excerpt">{record.excerpt}</p>}
                    <span className="writing-film-signature" aria-hidden>Cuhk_Chasing</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="writing-console__empty">
            <span className="writing-empty__frame" aria-hidden>00</span>
            <p>尚未发布文章</p>
          </div>
        )}
      </div>
    </section>
  );
}
