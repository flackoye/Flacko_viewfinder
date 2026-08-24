'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, FolderGit2, Sparkles, User, Menu, X, Flame, ScrollText } from 'lucide-react';
import BackgroundViewfinder from '@/components/BackgroundViewfinder';
import { PET_VIEWFINDER_EVENT, type PetViewfinderEventDetail } from '@/lib/pet-events';

const navItems = [
  { name: '首页', href: '/', icon: Sparkles },
  { name: '热点', href: '/trending', icon: Flame },
  { name: '项目', href: '/projects', icon: FolderGit2 },
  { name: '文章', href: '/records', icon: BookOpen },
  { name: '日志', href: '/changelog', icon: ScrollText },
  { name: '档案', href: '/about', icon: User },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [viewfinderOpen, setViewfinderOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMobileMenu = useCallback(() => {
    // 延迟关闭，让 Link 的导航事件先完成
    setTimeout(() => setMobileOpen(false), 120);
  }, []);

  const notifyPetViewfinder = useCallback((active: boolean) => {
    window.dispatchEvent(new CustomEvent<PetViewfinderEventDetail>(PET_VIEWFINDER_EVENT, {
      detail: { active },
    }));
  }, []);

  return (
    <>
      <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-nav shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="w-full px-4 md:px-6 py-5 flex items-center justify-between">
        {/* 左侧互动取景框 */}
        <button
          type="button"
          className="site-viewfinder-trigger"
          onClick={() => {
            notifyPetViewfinder(false);
            setViewfinderOpen(true);
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
            notifyPetViewfinder(true);
          }}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - bounds.left) / bounds.width) * 100;
            const y = ((event.clientY - bounds.top) / bounds.height) * 100;
            const normalizedX = x / 100 - 0.5;
            const normalizedY = y / 100 - 0.5;
            event.currentTarget.style.setProperty('--vf-x', `${x}%`);
            event.currentTarget.style.setProperty('--vf-y', `${y}%`);
            event.currentTarget.style.setProperty('--vf-rx', `${normalizedY * -3.5}deg`);
            event.currentTarget.style.setProperty('--vf-ry', `${normalizedX * 4.5}deg`);
            event.currentTarget.style.setProperty('--vf-shift-x', `${normalizedX * 3}px`);
            event.currentTarget.style.setProperty('--vf-shift-y', `${normalizedY * 2}px`);
          }}
          onPointerLeave={(event) => {
            notifyPetViewfinder(false);
            event.currentTarget.style.setProperty('--vf-x', '50%');
            event.currentTarget.style.setProperty('--vf-y', '50%');
            event.currentTarget.style.setProperty('--vf-rx', '0deg');
            event.currentTarget.style.setProperty('--vf-ry', '0deg');
            event.currentTarget.style.setProperty('--vf-shift-x', '0px');
            event.currentTarget.style.setProperty('--vf-shift-y', '0px');
          }}
          aria-label="打开 Flacko 取景框查看背景原图"
          aria-haspopup="dialog"
        >
          <span className="site-viewfinder-trigger__glass" aria-hidden />
          <span className="site-viewfinder-trigger__brand">
            <span className="site-viewfinder-trigger__signature font-[family-name:var(--font-dancing)] text-2xl md:text-3xl tracking-wider text-accent">
              Flacko
            </span>
            <span className="site-subname">取景框</span>
          </span>
        </button>

        {/* 右侧导航 */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-accent' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* 移动端菜单按钮 */}
        <button
          className="md:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors relative z-[60]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 移动端菜单 — 始终渲染，CSS 控制显隐 */}
      <div
        className={`md:hidden fixed inset-0 top-0 z-50 transition-opacity duration-300 ${
          mobileOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* 遮罩层 */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        {/* 菜单面板 — 从顶部滑下 */}
        <div
          className={`relative mt-[72px] glass-nav border-t border-white/5 transition-transform duration-300 ${
            mobileOpen ? 'translate-y-0' : '-translate-y-4'
          }`}
        >
          <div className="px-6 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'text-accent bg-accent/10'
                      : 'text-text-muted hover:text-text hover:bg-white/5'
                  }`}
                  onClick={closeMobileMenu}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      </nav>
      <BackgroundViewfinder open={viewfinderOpen} onClose={() => setViewfinderOpen(false)} />
    </>
  );
}
