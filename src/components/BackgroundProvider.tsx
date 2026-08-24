'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { siteFilm } from '@/data/site-film';
import {
  dataUrlToBlob,
  deleteVisitorBackground,
  loadVisitorBackground,
  saveVisitorBackground,
  type VisitorBackground,
} from '@/lib/visitor-background';
import { defaultSettings } from '@/lib/settings';
import { useSettings } from '@/components/SettingsProvider';

export interface ActiveBackground {
  image: string;
  originalImage: string;
  title: string;
  date: string;
  note: string;
  position: { x: number; y: number };
  source: 'visitor' | 'site';
}

interface BackgroundContextValue {
  activeBackground: ActiveBackground;
  visitorBackground: VisitorBackground | null;
  saveVisitor: (background: VisitorBackground) => Promise<void>;
  removeVisitor: () => Promise<void>;
}

const siteBackground: ActiveBackground = {
  image: siteFilm.image,
  originalImage: siteFilm.image,
  title: siteFilm.title ?? '',
  date: siteFilm.date ?? '',
  note: siteFilm.note ?? '',
  position: siteFilm.position,
  source: 'site',
};

const BackgroundContext = createContext<BackgroundContextValue>({
  activeBackground: siteBackground,
  visitorBackground: null,
  saveVisitor: async () => {},
  removeVisitor: async () => {},
});

export function useBackground() {
  return useContext(BackgroundContext);
}

export default function BackgroundProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const [visitorBackground, setVisitorBackground] = useState<VisitorBackground | null>(null);
  const [visitorUrls, setVisitorUrls] = useState({ image: '', originalImage: '' });
  const objectUrlsRef = useRef<string[]>([]);

  const setLoadedBackground = useCallback((background: VisitorBackground | null) => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];

    if (!background) {
      setVisitorUrls({ image: '', originalImage: '' });
      setVisitorBackground(null);
      return;
    }

    const image = URL.createObjectURL(background.image);
    const originalImage = background.originalImage && background.originalImage !== background.image
      ? URL.createObjectURL(background.originalImage)
      : image;
    objectUrlsRef.current = image === originalImage ? [image] : [image, originalImage];
    setVisitorUrls({ image, originalImage });
    setVisitorBackground(background);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        let stored = await loadVisitorBackground();
        const legacyImage = settings.backgroundImage;

        if (!stored && legacyImage.startsWith('data:image/')) {
          const legacyBlob = await dataUrlToBlob(legacyImage);
          stored = {
            id: 'current',
            image: legacyBlob,
            originalImage: legacyBlob,
            title: '',
            date: '',
            note: '',
            position: { x: 50, y: 35 },
            updatedAt: new Date().toISOString(),
          };
          await saveVisitorBackground(stored);
        }

        if (legacyImage !== defaultSettings.backgroundImage) {
          update({ backgroundImage: defaultSettings.backgroundImage });
        }
        if (!cancelled) setLoadedBackground(stored ?? null);
      } catch (error) {
        console.warn('访客背景加载失败:', error);
      }
    };

    void hydrate();
    return () => { cancelled = true; };
  }, [setLoadedBackground, settings.backgroundImage, update]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const saveVisitor = useCallback(async (background: VisitorBackground) => {
    await saveVisitorBackground(background);
    setLoadedBackground(background);
  }, [setLoadedBackground]);

  const removeVisitor = useCallback(async () => {
    await deleteVisitorBackground();
    setLoadedBackground(null);
  }, [setLoadedBackground]);

  const activeBackground = useMemo<ActiveBackground>(() => visitorBackground && visitorUrls.image
    ? {
        image: visitorUrls.image,
        originalImage: visitorUrls.originalImage,
        title: visitorBackground.title,
        date: visitorBackground.date,
        note: visitorBackground.note,
        position: visitorBackground.position,
        source: 'visitor',
      }
    : siteBackground,
  [visitorBackground, visitorUrls]);

  const value = useMemo(() => ({
    activeBackground,
    visitorBackground,
    saveVisitor,
    removeVisitor,
  }), [activeBackground, removeVisitor, saveVisitor, visitorBackground]);

  return <BackgroundContext.Provider value={value}>{children}</BackgroundContext.Provider>;
}
