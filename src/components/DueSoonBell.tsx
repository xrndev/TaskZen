'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNow } from '@/lib/useNow';
import type { Task } from '@/types';

const SOON_MS = 48 * 60 * 60 * 1000;

/**
 * Aviso dentro de la app (sustituye a los recordatorios por correo mientras no haya SMTP):
 * tareas abiertas asignadas a mí que vencieron o vencen en las próximas 48 horas.
 */
export function DueSoonBell({ tasks, userId, onOpen, size = 'md' }: { tasks: Task[]; userId: string; onOpen: (t: Task) => void; size?: 'md' | 'lg' }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const now = useNow();

  const due = useMemo(() => {
    const limit = now + SOON_MS;
    return tasks
      .filter(t => t.assigned_to === userId && t.status !== 'completed' && t.due_date && Date.parse(t.due_date) <= limit)
      .sort((a, b) => Date.parse(a.due_date!) - Date.parse(b.due_date!));
  }, [tasks, userId, now]);

  const overdueCount = due.filter(t => Date.parse(t.due_date!) < now).length;

  const toggle = () => {
    if (pos) return setPos(null);
    const r = button.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        title="Vencimientos próximos"
        aria-label={`Vencimientos próximos: ${due.length}`}
        aria-expanded={!!pos}
        className={size === 'lg' ? 'relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary' : 'relative w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-high border md:border-2 border-outline-variant/30 hover:border-primary/60 text-on-surface-variant hover:text-primary transition-colors shadow-sm'}
      >
        <Bell className="w-4 h-4 md:w-5 md:h-5" />
        {due.length > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${overdueCount ? 'bg-error text-white' : 'bg-primary text-black'}`}>{due.length}</span>
        )}
      </button>

      {/* Portal: la cabecera crea su propio contexto de apilamiento y taparía el desplegable. */}
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setPos(null)} />
          <div style={{ top: pos.top, right: pos.right }} className="fixed z-[95] w-72 max-w-[calc(100vw-1rem)] bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl p-3">
            <h3 className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tus tareas por vencer</h3>
            {due.length === 0 ? (
              <p className="px-1 py-3 text-xs text-on-surface-variant">Nada urgente por ahora.</p>
            ) : (
              <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto">
                {due.map(t => {
                  const late = Date.parse(t.due_date!) < now;
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => { setPos(null); onOpen(t); }} className="w-full text-left px-2 py-2 rounded-lg hover:bg-surface-container-high transition-colors">
                        <p className="text-xs font-medium text-on-surface truncate">{t.title}</p>
                        <p className={`text-[10px] ${late ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                          {late ? 'Vencida · ' : 'Vence · '}{new Date(t.due_date!).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
