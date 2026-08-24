'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackground } from '@/components/BackgroundProvider';

interface BackgroundViewfinderProps {
  open: boolean;
  onClose: () => void;
}

export default function BackgroundViewfinder({ open, onClose }: BackgroundViewfinderProps) {
  const { activeBackground } = useBackground();
  const [flipped, setFlipped] = useState(false);
  const { originalImage, title, date, note } = activeBackground;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFlipped(false);
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const close = () => {
    setFlipped(false);
    onClose();
  };

  return createPortal(
    <div className="background-viewfinder" role="dialog" aria-modal="true" aria-label="背景底片取景框" onClick={close}>
      <div className="background-viewfinder__vignette" aria-hidden />
      <div className="background-viewfinder__reticle" aria-hidden>
        <i /><i /><i /><i />
        <span />
      </div>

      <button type="button" className="background-viewfinder__close" onClick={close} aria-label="退出取景框">
        <X aria-hidden />
      </button>

      <div className="background-viewfinder__stage" onClick={event => event.stopPropagation()}>
        <button
          type="button"
          className={`background-photo-card ${flipped ? 'background-photo-card--flipped' : ''}`}
          onClick={() => setFlipped(value => !value)}
          aria-label={flipped ? '翻回背景原图' : '翻转照片查看信息'}
        >
          <span className="background-photo-card__inner">
            <span className="background-photo-card__face background-photo-card__front" aria-hidden={flipped}>
              <Image
                src={originalImage}
                alt={title || '背景原图'}
                fill
                sizes="(max-width: 768px) 92vw, 82vw"
                className="object-contain"
                unoptimized
                priority
              />
            </span>

            <span className="background-photo-card__face background-photo-card__back" aria-hidden={!flipped}>
              <span className="background-photo-card__back-content">
                {date && <time>{date.replaceAll('-', '.')}</time>}
                <strong>{title || '未命名底片'}</strong>
                <span className="background-photo-card__description">
                  “{note || '这张照片暂时没有留下文字。'}”
                </span>
                <span className="background-photo-card__signature" aria-label="Flacko 签名">Flacko</span>
              </span>
            </span>
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
