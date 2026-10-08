import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motionExitDuration, useReducedMotion } from '../../core/motion';

type PanelMode = 'edit' | 'products';
type Props = {
  open: boolean;
  mode: PanelMode;
  focusOnMount: boolean;
  scrollPositions: RefObject<Record<PanelMode, number>>;
  onScrollPositionChange: (mode: PanelMode, position: number) => void;
  children: (mode: PanelMode) => ReactNode;
};

// Keep one panel alive through its exit; switch content only after that exit ends.
export default function RoomPanelTransition({open, mode, focusOnMount, scrollPositions, onScrollPositionChange, children}: Props) {
  const reduced = useReducedMotion();
  const [shownMode,setShownMode] = useState(mode);
  const host = useRef<HTMLDivElement>(null);
  const lastMode = useRef(mode);
  if (reduced && shownMode !== mode) setShownMode(mode);
  const switching = open && shownMode !== mode && !reduced;
  const closing = !open || switching;

  useEffect(() => {
    if (!switching) return;
    const timer = window.setTimeout(() => setShownMode(mode), motionExitDuration);
    return () => window.clearTimeout(timer);
  },[switching,mode]);

  useLayoutEffect(() => {
    const element = host.current;
    const positions = scrollPositions.current;
    const scroll = element?.querySelector<HTMLElement>('.rc-items, .rc-planner-content');
    if (scroll) scroll.scrollTop = positions[shownMode];
    if (!closing && (lastMode.current !== shownMode || focusOnMount && document.activeElement === document.body)) {
      const heading = element?.querySelector<HTMLElement>('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      lastMode.current = shownMode;
    }
    return () => { if (scroll?.isConnected) onScrollPositionChange(shownMode, scroll.scrollTop); };
  },[shownMode,scrollPositions,onScrollPositionChange,closing,focusOnMount]);

  return <div key={shownMode} ref={host} onScrollCapture={event=>{const scroll=event.target;if(scroll instanceof HTMLElement&&scroll.matches('.rc-items, .rc-planner-content'))onScrollPositionChange(shownMode,scroll.scrollTop);}} className="rc-panel-transition" data-panel-state={closing?'closing':'open'} data-panel-mode={shownMode} inert={closing} aria-hidden={closing || undefined}>
    {children(shownMode)}
  </div>;
}
