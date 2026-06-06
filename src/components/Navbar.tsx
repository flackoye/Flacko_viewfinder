'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, FolderGit2, Sparkles, User, Menu, X, Flame, ScrollText } from 'lucide-react';

const navItems = [
  { name: '首页', href: '/', icon: Sparkles },
  { name: '热点', href: '/trending', icon: Flame },
  { name: '笔记', href: '/notes', icon: BookOpen },
  { name: '项目', href: '/projects', icon: FolderGit2 },
  { name: '日志', href: '/changelog', icon: ScrollText },
  { name: '关于', href: '/about', icon: User },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 路由变化时关闭菜单
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobileMenu = useCallback(() => {
    // 延迟关闭，让 Link 的导航事件先完成
    setTimeout(() => setMobileOpen(false), 120);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-nav shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="w-full px-4 md:px-6 py-5 flex items-center justify-between">
        {/* 左侧站名 — 大气设计 */}
        <Link href="/" className="group flex items-baseline gap-3 select-none">
          <span className="font-[family-name:var(--font-dancing)] text-2xl md:text-3xl tracking-wider text-accent">
            Flacko
          </span>
          <span className="site-subname text-xs md:text-sm tracking-widest">
            的取景框
          </span>
        </Link>

        {/* 右侧导航 */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isActive
                    ? 'text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
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
              const isActive = pathname === item.href;
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
  );
}
