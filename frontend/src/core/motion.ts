import { useSyncExternalStore, type CSSProperties } from 'react';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window === 'undefined' || window.matchMedia(reducedMotionQuery).matches;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => true);
}

/** Call at activation time so preference changes also apply to imperative scrolling. */
export function motionScrollIntoView(element: Element | null | undefined, options: ScrollIntoViewOptions = {}): void {
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest', ...options,
    behavior: prefersReducedMotion() ? 'instant' : (options.behavior ?? 'smooth') });
}

export function motionStaggerStyle(index: number): CSSProperties {
  return { '--motion-delay': `${Math.min(120, Math.max(0, Number.isFinite(index) ? index : 0) * 30)}ms` } as CSSProperties;
}

/** Matches --motion-exit-duration in the shared stylesheet. */
export const motionExitDuration = 150;
