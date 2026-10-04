import type { CSSProperties } from 'react';

const assets = import.meta.glob('./reference-assets/reference-*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Original, script-free vector assets from the supplied design HTML. */
export default function ReferenceSvg({ page, index, style }: { page: number; index: number; style?: CSSProperties }) {
  return <span style={{ display: 'contents', ...style }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: assets[`./reference-assets/reference-${page}-${index}.svg`] ?? '' }} />;
}
