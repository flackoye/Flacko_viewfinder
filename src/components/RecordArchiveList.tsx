'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ArchiveRecord {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
}

export default function RecordArchiveList({ records }: { records: ArchiveRecord[] }) {
  const [activeSlug, setActiveSlug] = useState(records[0]?.slug ?? '');
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const slug = (visible?.target as HTMLElement | undefined)?.dataset.slug;
      if (slug) setActiveSlug(slug);
    }, {
      rootMargin: '-24% 0px -38% 0px',
      threshold: [0.25, 0.5, 0.75],
    });

    itemRefs.current.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [records]);

  return (
    <ol className="record-archive" aria-label="文章归档">
      {records.map((record, index) => (
        <li
          key={record.slug}
          ref={(node) => {
            if (node) itemRefs.current.set(record.slug, node);
            else itemRefs.current.delete(record.slug);
          }}
          data-slug={record.slug}
          className={`record-archive__frame ${activeSlug === record.slug ? 'is-active' : ''}`}
        >
          <span className="record-archive__number" aria-hidden>{String(index + 1).padStart(2, '0')}</span>
          <time className="record-archive__date">{record.date.replaceAll('-', '.')}</time>
          <Link href={`/records/${record.slug}`} className="record-archive__link">
            <span className="record-archive__content">
              <span className="record-archive__title">{record.title}</span>
              {record.summary && <span className="record-archive__summary">{record.summary}</span>}
              {record.tags.length > 0 && (
                <span className="record-archive__tags">
                  {record.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                </span>
              )}
            </span>
            <ArrowUpRight className="record-archive__arrow" aria-hidden />
          </Link>
        </li>
      ))}
    </ol>
  );
}
