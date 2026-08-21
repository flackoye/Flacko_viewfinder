'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Bookmark, GitFork, Trophy, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

export interface ProfileCardFact {
  label: string;
  value: string;
}

export interface ProfileCardItem {
  label: string;
  href?: string;
  description?: string;
  image?: string;
  facts?: ProfileCardFact[];
}

interface ProfileCardGalleryProps {
  items: ProfileCardItem[];
  eyebrow: string;
  kind: 'bookmark' | 'competition' | 'github';
  size?: 'standard' | 'large';
}

const kindIcons = {
  bookmark: Bookmark,
  competition: Trophy,
  github: GitFork,
};

export default function ProfileCardGallery({
  items,
  eyebrow,
  kind,
  size = 'standard',
}: ProfileCardGalleryProps) {
  const [activeItem, setActiveItem] = useState<ProfileCardItem | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const EyebrowIcon = kindIcons[kind];

  useEffect(() => {
    if (!activeItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveItem(null);
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, a[href]'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      lastTriggerRef.current?.focus();
    };
  }, [activeItem]);

  const openItem = (item: ProfileCardItem, event: MouseEvent<HTMLButtonElement>) => {
    lastTriggerRef.current = event.currentTarget;
    setActiveItem(item);
  };

  const modalContent = (
    <AnimatePresence>
      {activeItem && (
        <motion.div
          className="bookmark-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="bookmark-modal__backdrop"
            onClick={() => setActiveItem(null)}
            aria-label={`关闭${eyebrow}`}
          />
          <motion.section
            ref={dialogRef}
            className={`bookmark-modal__card ${size === 'large' ? 'bookmark-modal__card--large' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-card-dialog-title"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="bookmark-modal__corner bookmark-modal__corner--tl" aria-hidden />
            <span className="bookmark-modal__corner bookmark-modal__corner--tr" aria-hidden />
            <span className="bookmark-modal__corner bookmark-modal__corner--bl" aria-hidden />
            <span className="bookmark-modal__corner bookmark-modal__corner--br" aria-hidden />
            <button
              ref={closeButtonRef}
              type="button"
              className="bookmark-modal__close"
              onClick={() => setActiveItem(null)}
              aria-label={`关闭${eyebrow}`}
            >
              <X />
            </button>
            <div className="bookmark-modal__eyebrow">
              <EyebrowIcon /> {eyebrow}
            </div>
            <h3 id="profile-card-dialog-title">{activeItem.label}</h3>

            {activeItem.facts && activeItem.facts.length > 0 && (
              <dl className="bookmark-modal__facts">
                {activeItem.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {activeItem.image && (
              <a
                href={activeItem.image}
                target="_blank"
                rel="noopener noreferrer"
                className="bookmark-modal__image"
                aria-label={`查看${activeItem.label}的证明图片原图`}
              >
                <Image
                  src={activeItem.image}
                  alt={`${activeItem.label}的证明图片`}
                  fill
                  sizes="(max-width: 768px) 90vw, 720px"
                  className="object-contain"
                />
              </a>
            )}

            {activeItem.href && (
              <a
                href={activeItem.href}
                target={activeItem.href.startsWith('http') ? '_blank' : undefined}
                rel={activeItem.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="bookmark-modal__href"
              >
                <span>{activeItem.href}</span>
                <ArrowUpRight />
              </a>
            )}
            {activeItem.description && (
              <p className="bookmark-modal__description">{activeItem.description}</p>
            )}
            <span className="bookmark-modal__signature" aria-hidden>Cuhk_Chasing</span>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
  const modal = typeof document === 'undefined'
    ? null
    : createPortal(modalContent, document.body);

  return (
    <>
      <div className={`bookmark-index ${size === 'large' ? 'bookmark-index--large' : ''}`}>
        {items.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            type="button"
            className="bookmark-index__item"
            onClick={(event) => openItem(item, event)}
          >
            <span className="bookmark-index__number">{String(index + 1).padStart(2, '0')}</span>
            <span className="bookmark-index__title">{item.label}</span>
            <span className="bookmark-index__focus" aria-hidden />
          </button>
        ))}
      </div>
      {modal}
    </>
  );
}
