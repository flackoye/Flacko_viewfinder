'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { BG_PRESETS } from '@/components/StarfieldBackground';

const STORAGE_KEY = 'projects-bg';
const CHANGE_EVENT = 'projects-background-change';

function normalizeIndex(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < BG_PRESETS.length
    ? parsed
    : 0;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  return normalizeIndex(localStorage.getItem(STORAGE_KEY));
}

function getServerSnapshot() {
  return 0;
}

/** 跨项目子页面共享并校验背景预设。 */
export function useProjectBackground() {
  const backgroundIndex = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setBackgroundIndex = useCallback((nextIndex: number) => {
    const normalized = normalizeIndex(String(nextIndex));
    localStorage.setItem(STORAGE_KEY, String(normalized));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [backgroundIndex, setBackgroundIndex] as const;
}
