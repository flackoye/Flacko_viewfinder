/**
 * 首页公开底片。
 * 修改图片与文字后重新部署，所有未使用访客背景的人都会看到。
 * title、date、note 全部留空时，首页不会显示底片签注。
 */
export interface SiteFilm {
  image: string;
  title?: string;
  date?: string;
  note?: string;
  position: { x: number; y: number };
}

export const siteFilm: SiteFilm = {
  image: '/backgrounds/HUBEI_JiaYu_0820.jpg',
  title: '湖北，嘉鱼',
  date: '2026-08-20',
  note: '给爷爷烧纸那天，老李骑着"马车"望着...',
  position: { x: 50, y: 35 },
};
