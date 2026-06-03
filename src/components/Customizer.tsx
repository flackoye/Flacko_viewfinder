'use client';

import { useState, useRef } from 'react';
import { Settings, X, Upload, RotateCcw, Sun, Droplets, Layers } from 'lucide-react';
import { useSettings } from '@/components/SettingsProvider';
import { defaultSettings, fileToDataUrl } from '@/lib/settings';

export default function Customizer() {
  const [open, setOpen] = useState(false);
  const { settings, update } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const handleUpdate = (partial: Parameters<typeof update>[0]) => {
    update(partial);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      handleUpdate({ backgroundImage: dataUrl });
    } catch {
      // 文件读取失败
    }
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
      >
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-text">自定义</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 背景图上传 */}
          <section className="mb-8">
            <label className="flex items-center gap-2 text-sm font-medium text-text-muted mb-3">
              <Upload className="w-4 h-4" />
              背景图片
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-xl glass text-sm text-text-muted hover:text-accent hover:border-accent/20 transition-all duration-200"
            >
              点击上传图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            {settings.backgroundImage !== defaultSettings.backgroundImage && (
              <button
                onClick={() => handleUpdate({ backgroundImage: defaultSettings.backgroundImage })}
                className="w-full mt-2 py-2 text-xs text-text-dim hover:text-accent transition-colors"
              >
                恢复默认背景
              </button>
            )}
          </section>

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

          {/* 重置 */}
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl glass text-sm text-text-muted hover:text-accent transition-all duration-200 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            恢复默认设置
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
