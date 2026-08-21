'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition() {
  const pathname = usePathname();

  return (
    <div key={pathname} className="viewfinder-transition" aria-hidden>
      <div className="viewfinder-transition__aperture" />
      <div className="viewfinder-transition__blades" />
      <div className="viewfinder-transition__focus">
        <span className="viewfinder-transition__crosshair" />
      </div>
      <div className="viewfinder-transition__scan" />
    </div>
  );
}
