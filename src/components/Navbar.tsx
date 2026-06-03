'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, FolderGit2, Sparkles, User, Menu, X, Flame } from 'lucide-react';

const navItems = [
  { name: '首页', href: '/', icon: Sparkles },
  { name: '热点', href: '/trending', icon: Flame },
  { name: '笔记', href: '/notes', icon: BookOpen },
  { name: '项目', href: '/projects', icon: FolderGit2 },
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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass-nav shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="w-full px-4 md:px-6 py-5 flex items-center justify-between">
        {/* 左侧站名 — 大气设计 */}
        <Link href="/" className="group flex items-baseline gap-3 select-none">
          <span className="site-name text-xl md:text-2xl font-bold tracking-wider">
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
          className="md:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* 移动端菜单 */}
      {mobileOpen && (
        <div className="md:hidden glass-nav border-t border-white/5">
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
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
