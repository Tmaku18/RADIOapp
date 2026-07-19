'use client';

import { createPortal } from 'react-dom';

/**
 * Renders children on document.body so fixed overlays escape dashboard
 * stacking contexts (e.g. SidebarProvider z-10) and sit above the now-playing bar.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
