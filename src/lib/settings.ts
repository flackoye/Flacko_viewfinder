/**
 * 设置管理 — 用 localStorage 保存用户的自定义偏好
 *
 * 存储内容：
 * - backgroundImage: 背景图 URL（默认图片 / 用户上传的 data URL）
 * - brightness: 背景亮度 0~100
 * - overlayOpacity: 遮罩透明度 0~100（数值越小图越亮）
 * - cardGlass: 卡片玻璃透明度 0~100
 */

export interface SiteSettings {
  backgroundImage: string;
  brightness: number;       // 0~100, default 60
  overlayOpacity: number;   // 0~100, default 30
  cardGlass: number;        // 0~100, default 50
}

const STORAGE_KEY = 'flacko-settings';

export const defaultSettings: SiteSettings = {
  backgroundImage: '/home-bg.jpg',
  brightness: 60,
  overlayOpacity: 30,
  cardGlass: 50,
};

export function loadSettings(): SiteSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: SiteSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage 满了（可能因为上传的图太大），静默失败
  }
}

/** 把用户上传的图片文件转成 data URL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
