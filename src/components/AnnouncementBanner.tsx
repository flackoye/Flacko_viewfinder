'use client';

import { useState, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';

interface Announcement {
  message: string;
  type: 'info' | 'warning' | 'success';
  date: string;
  dismissible: boolean;
}

const STORAGE_KEY = 'flacko-announcement-dismissed';

// 公告类型 → 颜色
const typeStyles: Record<string, string> = {
  info:    'border-accent/30 bg-accent/10 text-accent-light',
  warning: 'border-[#ff9f43]/30 bg-[#ff9f43]/10 text-[#ff9f43]',
  success: 'border-[#2ecc71]/30 bg-[#2ecc71]/10 text-[#2ecc71]',
};

export default function AnnouncementBanner({ announcement }: { announcement: Announcement | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!announcement) return;
    // 检查用户是否已经关闭过这条公告（根据日期判断）
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== announcement.date) {
      setVisible(true);
    }
  }, [announcement]);

  if (!announcement || !visible) return null;

  const style = typeStyles[announcement.type] || typeStyles.info;

  const handleDismiss = () => {
    setVisible(false);
    if (announcement.dismissible) {
      localStorage.setItem(STORAGE_KEY, announcement.date);
    }
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-[51] border-b ${style}`}>
      <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 shrink-0" />
          <span className="text-sm">{announcement.message}</span>
        </div>
        {announcement.dismissible && (
          <button
            onClick={handleDismiss}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
