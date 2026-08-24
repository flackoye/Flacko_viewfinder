'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ImagePlus, Move, PencilLine, RotateCcw, X } from 'lucide-react';
import { useBackground } from '@/components/BackgroundProvider';
import { compressBackgroundImage, type BackgroundPosition } from '@/lib/visitor-background';

interface BackgroundStudioProps {
  onSaved: () => void;
}

function today() {
  const value = new Date();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function BackgroundStudio({ onSaved }: BackgroundStudioProps) {
  const { activeBackground, visitorBackground, saveVisitor, removeVisitor } = useBackground();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const ownedUrlRef = useRef('');
  const dragRef = useRef<{ x: number; y: number; position: BackgroundPosition } | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [originalImageBlob, setOriginalImageBlob] = useState<Blob | null>(null);
  const [imageSrc, setImageSrc] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [position, setPosition] = useState<BackgroundPosition>({ x: 50, y: 50 });

  useEffect(() => () => {
    if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
  }, []);

  const releaseOwnedUrl = () => {
    if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current);
    ownedUrlRef.current = '';
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setError('');
    releaseOwnedUrl();
  };

  const openExistingEditor = () => {
    if (!visitorBackground) return;
    releaseOwnedUrl();
    setImageBlob(visitorBackground.image);
    setOriginalImageBlob(visitorBackground.originalImage ?? visitorBackground.image);
    setImageSrc(activeBackground.image);
    setTitle(visitorBackground.title);
    setDate(visitorBackground.date);
    setNote(visitorBackground.note);
    setPosition(visitorBackground.position);
    setError('');
    setEditorOpen(true);
  };

  const chooseFile = () => {
    setNoticeOpen(false);
    fileInputRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProcessing(true);
    setError('');
    try {
      const compressed = await compressBackgroundImage(file);
      releaseOwnedUrl();
      ownedUrlRef.current = URL.createObjectURL(compressed);
      setImageBlob(compressed);
      setOriginalImageBlob(file);
      setImageSrc(ownedUrlRef.current);
      setTitle('');
      setDate(today());
      setNote('');
      setPosition({ x: 50, y: 50 });
      setEditorOpen(true);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片处理失败');
    } finally {
      setProcessing(false);
    }
  };

  const persist = async (withDetails: boolean) => {
    if (!imageBlob) return;
    setProcessing(true);
    setError('');
    try {
      await saveVisitor({
        id: 'current',
        image: imageBlob,
        originalImage: originalImageBlob ?? imageBlob,
        title: withDetails ? title.trim() : '',
        date: withDetails ? date.trim() : '',
        note: withDetails ? note.trim() : '',
        position,
        updatedAt: new Date().toISOString(),
      });
      closeEditor();
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '背景保存失败');
    } finally {
      setProcessing(false);
    }
  };

  const restoreSiteFilm = async () => {
    setProcessing(true);
    setError('');
    try {
      await removeVisitor();
      setRestoreOpen(false);
      onSaved();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : '恢复站长底片失败');
    } finally {
      setProcessing(false);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, position };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!drag || !bounds) return;
    setPosition({
      x: clamp(drag.position.x - ((event.clientX - drag.x) / bounds.width) * 100),
      y: clamp(drag.position.y - ((event.clientY - drag.y) / bounds.height) * 100),
    });
  };

  return (
    <>
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text-muted">
          <ImagePlus className="h-4 w-4" />
          访客背景
        </div>
        <button
          type="button"
          onClick={() => setNoticeOpen(true)}
          disabled={processing}
          className="background-studio__primary"
        >
          <ImagePlus className="h-4 w-4" />
          {processing ? '正在处理图片…' : visitorBackground ? '上传新图片' : '上传背景图片'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {visitorBackground && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={openExistingEditor} className="background-studio__secondary">
              <PencilLine className="h-3.5 w-3.5" /> 编辑与调整
            </button>
            <button type="button" onClick={() => setRestoreOpen(true)} className="background-studio__secondary">
              <RotateCcw className="h-3.5 w-3.5" /> 恢复站长底片
            </button>
          </div>
        )}
        {error && !editorOpen && <p className="mt-3 text-sm leading-6 text-red-300">{error}</p>}
      </section>

      {typeof document !== 'undefined' && createPortal(
        <>
          {noticeOpen && (
            <div className="background-modal" role="dialog" aria-modal="true" aria-labelledby="background-notice-title">
              <div className="background-modal__panel background-modal__panel--notice">
                <span className="background-modal__eyebrow">LOCAL FRAME</span>
                <h2 id="background-notice-title">这张图片只属于你的浏览器</h2>
                <p>图片不会上传到服务器。首页使用本地压缩版本保持流畅，互动取景框会读取保存在当前浏览器里的原图；清除网站数据后它们也会消失。</p>
                <div className="background-modal__actions">
                  <button type="button" onClick={() => setNoticeOpen(false)} className="background-modal__ghost">取消</button>
                  <button type="button" onClick={chooseFile} className="background-modal__confirm">继续选择图片</button>
                </div>
              </div>
            </div>
          )}

          {editorOpen && imageSrc && (
            <div className="background-modal" role="dialog" aria-modal="true" aria-labelledby="background-editor-title">
              <div className="background-modal__panel background-modal__panel--editor">
                <div className="background-editor__header">
                  <div>
                    <span className="background-modal__eyebrow">FRAME NOTE</span>
                    <h2 id="background-editor-title">留下这张底片的信息</h2>
                  </div>
                  <button type="button" onClick={closeEditor} aria-label="关闭背景编辑器"><X /></button>
                </div>

                <div className="background-editor__layout">
                  <div>
                    <div
                      ref={previewRef}
                      className="background-editor__preview"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={() => { dragRef.current = null; }}
                      onPointerCancel={() => { dragRef.current = null; }}
                    >
                      <Image
                        src={imageSrc}
                        alt="背景裁切预览"
                        width={1600}
                        height={1000}
                        className="absolute inset-0 h-full w-full"
                        unoptimized
                        draggable={false}
                        style={{ objectFit: 'cover', objectPosition: `${position.x}% ${position.y}%` }}
                      />
                      <span className="background-editor__grid" aria-hidden />
                      <span className="background-editor__focus" aria-hidden style={{ left: `${position.x}%`, top: `${position.y}%` }} />
                    </div>
                    <p className="background-editor__hint"><Move /> 拖动图片，调整首页最终显示的区域</p>
                  </div>

                  <div className="background-editor__fields">
                    <label>
                      <span>标题</span>
                      <input value={title} maxLength={32} onChange={event => setTitle(event.target.value)} placeholder="例如：南京，雨后" />
                    </label>
                    <label>
                      <span><CalendarDays /> 日期</span>
                      <input type="date" value={date} onChange={event => setDate(event.target.value)} />
                    </label>
                    <label>
                      <span>一句说明</span>
                      <textarea value={note} maxLength={120} onChange={event => setNote(event.target.value)} placeholder="那天结束了一场很长的讨论。" rows={4} />
                      <small>{note.length} / 120</small>
                    </label>
                  </div>
                </div>

                {error && <p className="background-editor__error">{error}</p>}
                <div className="background-modal__actions">
                  <button type="button" disabled={processing} onClick={() => void persist(false)} className="background-modal__ghost">跳过信息</button>
                  <button type="button" disabled={processing} onClick={() => void persist(true)} className="background-modal__confirm">
                    {processing ? '保存中…' : '保存为背景'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {restoreOpen && (
            <div className="background-modal" role="dialog" aria-modal="true" aria-labelledby="background-restore-title">
              <div className="background-modal__panel background-modal__panel--notice">
                <span className="background-modal__eyebrow">RESET FRAME</span>
                <h2 id="background-restore-title">恢复站长底片？</h2>
                <p>当前浏览器保存的背景图片、标题、日期和说明都会被删除，其他外观与阿岳设置不会改变。</p>
                <div className="background-modal__actions">
                  <button type="button" onClick={() => setRestoreOpen(false)} className="background-modal__ghost">取消</button>
                  <button type="button" disabled={processing} onClick={() => void restoreSiteFilm()} className="background-modal__confirm">
                    {processing ? '正在恢复…' : '确认恢复'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}
