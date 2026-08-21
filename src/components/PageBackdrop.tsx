type BackdropVariant = 'signals' | 'archive' | 'profile';

const LABELS: Record<BackdropVariant, string> = {
  signals: 'LIVE SIGNAL / 07 DAY WINDOW',
  archive: 'ARCHIVE / CHANGE LOG',
  profile: 'PERSONAL FILE / IN PROGRESS',
};

/** 内页共享的“取景框”氛围层；每个 variant 保留独立纹理。 */
export default function PageBackdrop({ variant }: { variant: BackdropVariant }) {
  return (
    <div className={`page-backdrop page-backdrop--${variant}`} aria-hidden>
      <div className="page-backdrop__mesh" />
      <div className="page-backdrop__glow page-backdrop__glow--one" />
      <div className="page-backdrop__glow page-backdrop__glow--two" />
      <div className="page-backdrop__grain" />
      <div className="page-backdrop__frame">
        <span>{LABELS[variant]}</span>
        <span>REC ●</span>
      </div>
    </div>
  );
}
