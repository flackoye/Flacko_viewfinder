'use client';

import { useSyncExternalStore } from 'react';
import { Megaphone, X } from 'lucide-react';

interface Announcement {
  message: string;
  type: 'info' | 'warning' | 'success' | 'feature';
  date: string;
  dismissible: boolean;
}

const STORAGE_KEY = 'flacko-announcement-dismissed';
const CHANGE_EVENT = 'flacko-announcement-change';

// 公告类型 → 颜色
const typeStyles: Record<string, string> = {
  info:    'border-accent/30 bg-accent/10 text-accent-light',
  warning: 'border-[#ff9f43]/30 bg-[#ff9f43]/10 text-[#ff9f43]',
  success: 'border-[#2ecc71]/30 bg-[#2ecc71]/10 text-[#2ecc71]',
  feature: 'border-klein/30 bg-klein/10 text-klein-light',
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getDismissedDate() {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

function getServerDismissedDate() {
  return '';
}

export default function AnnouncementBanner({ announcement }: { announcement: Announcement | null }) {
  const dismissedDate = useSyncExternalStore(
    subscribe,
    getDismissedDate,
    getServerDismissedDate,
  );
  const visible = Boolean(announcement && dismissedDate !== announcement.date);

  if (!announcement || !visible) return null;

  const style = typeStyles[announcement.type] || typeStyles.info;

  const handleDismiss = () => {
    if (announcement.dismissible) {
      localStorage.setItem(STORAGE_KEY, announcement.date);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  };

  return (
    <div className={`border-b ${style}`}>
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 shrink-0" />
          <span className="text-sm">{announcement.message}</span>
        </div>
        {announcement.dismissible && (
          <button
            onClick={handleDismiss}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="关闭公告"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
