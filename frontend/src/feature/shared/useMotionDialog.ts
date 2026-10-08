import { useLayoutEffect, useRef, type SyntheticEvent, type MouseEvent, type RefObject, type KeyboardEvent } from 'react';
import { useMotionPresence } from './useMotionPresence';
import './dialog-motion.css';

/** Keep native modal focus containment for the complete exit, including Escape. */
export function useMotionDialog(ref: RefObject<HTMLDialogElement | null>, open: boolean, requestClose: () => void) {
  const trigger = useRef<HTMLElement | null>(null);
  const presence = useMotionPresence(open);
  const closing = !open && presence.isPresent;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog?.isConnected) return;
    if (presence.isPresent) {
      if (!dialog.open) {
        // An external native close has already finished; do not show it again
        // merely to retain a cosmetic exit.
        if (closing) return;
        trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      }
      if (closing) dialog.focus({ preventScroll: true });
      else if (document.activeElement === dialog) {
        dialog.querySelector<HTMLElement>('[autofocus], button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled)')?.focus({ preventScroll: true });
      }
    } else {
      if (dialog.open) dialog.close();
      const target = trigger.current;
      if (target?.isConnected && !target.closest('[inert], [aria-hidden="true"]') && !target.matches(':disabled, [aria-disabled="true"]')) target.focus({ preventScroll: true });
      trigger.current = null;
    }
  }, [presence.isPresent, closing, ref]);

  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => { if (dialog?.open) dialog.close(); };
  }, [ref]);

  return {
    closing,
    state: presence.state,
    onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
      // Native Tab can leave an empty modal when all exit actions are inert.
      if (closing && event.key === 'Tab') {
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
      }
    },
    onCancel(event: SyntheticEvent<HTMLDialogElement>) {
      event.preventDefault();
      if (open) requestClose();
    },
    onClose(event: SyntheticEvent<HTMLDialogElement>) {
      // Ignore delayed native close events if a fresh open has already won.
      if (!event.currentTarget.open && open) requestClose();
    },
    onClick(event: MouseEvent<HTMLDialogElement>) {
      if (!open || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
    },
  };
}
