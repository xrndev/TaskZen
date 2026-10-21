'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Hoja que sube desde abajo (patrón móvil). Es un diálogo modal: cierra con Escape o tocando fuera,
 * devuelve el foco a quien la abrió y respeta el espacio de seguridad del iPhone.
 */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-outline-variant/20 bg-surface-container-low shadow-[0_-12px_40px_rgba(0,0,0,0.5)] outline-none animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-surface-container-low px-5 pt-4 pb-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-outline-variant/40" aria-hidden />
          <h2 id={titleId} className="text-base font-bold text-on-surface">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
