'use client';

import { useState } from 'react';
import {
  Settings,
  X,
  RotateCcw,
  Sun,
  Droplets,
  Layers,
  Eye,
} from 'lucide-react';
import { useSettings } from '@/components/SettingsProvider';
import { defaultSettings } from '@/lib/settings';
import BackgroundStudio from '@/components/BackgroundStudio';

export default function Customizer() {
  const [open, setOpen] = useState(false);
  const { settings, update } = useSettings();
  const [saved, setSaved] = useState(false);

  const handleUpdate = (partial: Parameters<typeof update>[0]) => {
    update(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    handleUpdate(defaultSettings);
  };

  return (
    <>
      {/* 浮动齿轮按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[60] w-11 h-11 rounded-full glass flex items-center justify-center text-text-muted hover:text-accent transition-all duration-300 hover:scale-110"
        aria-label="自定义设置"
        aria-expanded={open}
      >
        <Settings className={`w-5 h-5 transition-transform duration-500 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 保存提示 */}
      {saved && (
        <div className="fixed bottom-20 right-6 z-[60] glass px-4 py-2 text-sm text-accent animate-pulse">
          ✓ 已保存
        </div>
      )}

      {/* 面板 */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-[59] glass-nav transition-transform duration-500 ease-out overflow-y-auto ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ borderRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        role="dialog"
        aria-modal="true"
        aria-label="主页外观设置"
        aria-hidden={!open}
      >
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-text">自定义</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text transition-colors"
              aria-label="关闭自定义面板"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <BackgroundStudio onSaved={() => handleUpdate({})} />

          {/* 亮度 */}
          <section className="mb-8">
            <label className="flex items-center justify-between text-sm font-medium text-text-muted mb-3">
              <span className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                背景亮度
              </span>
              <span className="text-accent text-xs">{settings.brightness}%</span>
            </label>
            <input
              type="range"
              min={20}
              max={150}
              value={settings.brightness}
              onChange={(e) => handleUpdate({ brightness: Number(e.target.value) })}
              className="custom-slider w-full"
            />
          </section>

          {/* 遮罩透明度 */}
          <section className="mb-8">
            <label className="flex items-center justify-between text-sm font-medium text-text-muted mb-3">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                遮罩浓度
              </span>
              <span className="text-accent text-xs">{settings.overlayOpacity}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={80}
              value={settings.overlayOpacity}
              onChange={(e) => handleUpdate({ overlayOpacity: Number(e.target.value) })}
              className="custom-slider w-full"
            />
            <p className="text-xs text-text-dim mt-1">数值越小背景越亮</p>
          </section>

          {/* 卡片玻璃感 */}
          <section className="mb-8">
            <label className="flex items-center justify-between text-sm font-medium text-text-muted mb-3">
              <span className="flex items-center gap-2">
                <Droplets className="w-4 h-4" />
                玻璃通透感
              </span>
              <span className="text-accent text-xs">{settings.cardGlass}%</span>
            </label>
            <input
              type="range"
              min={10}
              max={90}
              value={settings.cardGlass}
              onChange={(e) => handleUpdate({ cardGlass: Number(e.target.value) })}
              className="custom-slider w-full"
            />
          </section>

          <section className="mb-8 border-t border-white/[0.07] pt-7">
            <h3 className="mb-5 text-xs font-medium tracking-[0.16em] text-text-dim">阿岳</h3>

            <div className="mb-5 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm font-medium text-text-muted">
                <Eye className="h-4 w-4" />
                显示阿岳
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.petVisible}
                onClick={() => handleUpdate({ petVisible: !settings.petVisible })}
                className={`relative h-6 w-11 rounded-full border transition-colors ${
                  settings.petVisible
                    ? 'border-accent/40 bg-accent/25'
                    : 'border-white/10 bg-white/[0.05]'
                }`}
              >
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                    settings.petVisible ? 'left-6 bg-accent' : 'left-1 bg-text-dim'
                  }`}
                />
              </button>
            </div>

          </section>

          {/* 重置 */}
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl glass text-sm text-text-muted hover:text-accent transition-all duration-200 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            恢复外观参数
          </button>
        </div>
      </div>

      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-[58] bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
