'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { loadSettings, saveSettings, defaultSettings, type SiteSettings } from '@/lib/settings';

const SettingsContext = createContext<{
  settings: SiteSettings;
  update: (partial: Partial<SiteSettings>) => void;
}>({
  settings: defaultSettings,
  update: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = useCallback((partial: Partial<SiteSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}
