import { useEffect, useState } from 'react';
import { motionExitDuration, useReducedMotion } from '../../core/motion';

/**
 * Retain one existing subtree for its exit; reopening cancels the pending removal.
 * Nonmodal consumers must make the closing subtree inert and aria-hidden.
 * Native dialogs keep showModal() until isPresent is false to retain focus containment.
 * Use only for surfaces that need exit retention, never to duplicate a WebGL viewer.
 */
export function useMotionPresence(open: boolean, exitDuration = motionExitDuration) {
  const reducedMotion = useReducedMotion();
  const [previousOpen, setPreviousOpen] = useState(open);
  const [exiting, setExiting] = useState(false);

  // Derive the transition in render so close is reflected before paint, without
  // synchronizing props into state in an effect or delaying activation.
  if (previousOpen !== open) {
    setPreviousOpen(open);
    setExiting(!open && !reducedMotion);
  }
  if (exiting && reducedMotion) setExiting(false);

  useEffect(() => {
    if (open || !exiting || reducedMotion) return;
    const timer = window.setTimeout(() => setExiting(false), Math.max(0, exitDuration));
    return () => window.clearTimeout(timer);
  }, [open, exiting, reducedMotion, exitDuration]);

  return {
    isPresent: open || (exiting && !reducedMotion),
    state: open ? 'open' as const : 'closing' as const,
  };
}
