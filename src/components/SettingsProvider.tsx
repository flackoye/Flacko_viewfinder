'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { loadSettings, saveSettings, defaultSettings, type SiteSettings } from '@/lib/settings';

const SETTINGS_EVENT = 'flacko-settings-change';

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(SETTINGS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(SETTINGS_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return localStorage.getItem('flacko-settings') ?? '';
}

function getServerSnapshot() {
  return '';
}

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
  const serializedSettings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const settings = useMemo(
    () => serializedSettings ? loadSettings() : defaultSettings,
    [serializedSettings],
  );

  const update = useCallback((partial: Partial<SiteSettings>) => {
    const next = { ...loadSettings(), ...partial };
    saveSettings(next);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}
