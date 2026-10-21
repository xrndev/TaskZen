'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, TaskStatus } from '@/types';

const DOT: Record<TaskStatus, string> = {
  pending: 'bg-secondary/20 text-secondary border-secondary/30',
  in_progress: 'bg-primary/20 text-primary border-primary/30',
  completed: 'bg-tertiary/20 text-tertiary border-tertiary/30 line-through opacity-70',
};
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MAX_PER_DAY = 3;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function CalendarView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    const undated: Task[] = [];
    for (const t of tasks) {
      if (!t.due_date) { undated.push(t); continue; }
      const k = dayKey(new Date(t.due_date));
      byDay.set(k, [...(byDay.get(k) ?? []), t]);
    }
    return { byDay, undated };
  }, [tasks]);

  // Semanas desde el lunes, rellenando con los días de los meses contiguos.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const total = Math.ceil((offset + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - offset + 1));
  }, [cursor]);

  const today = dayKey(new Date());
  const title = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (delta: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <div className="flex-1 overflow-auto p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-on-surface capitalize">{title}</h2>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Mes anterior" onClick={() => move(-1)} className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 hover:text-primary"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="px-3 py-2 rounded-lg bg-surface-container border border-outline-variant/20 text-[10px] font-bold uppercase tracking-wider hover:text-primary">Hoy</button>
          <button type="button" aria-label="Mes siguiente" onClick={() => move(1)} className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 hover:text-primary"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="min-w-[640px] grid grid-cols-7 border border-surface-container-high rounded-xl overflow-hidden bg-surface-container-low">
        {WEEKDAYS.map(d => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant bg-surface-container border-b border-surface-container-high">{d}</div>
        ))}
        {cells.map(date => {
          const k = dayKey(date);
          const inMonth = date.getMonth() === cursor.getMonth();
          const list = byDay.get(k) ?? [];
          return (
            <div key={k} className={`min-h-[104px] p-1.5 border-b border-r border-surface-container-high/60 ${inMonth ? '' : 'bg-surface-container/40'}`}>
              <div className={`mb-1 w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-semibold ${k === today ? 'bg-primary text-black' : inMonth ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>{date.getDate()}</div>
              <div className="flex flex-col gap-1">
                {list.slice(0, MAX_PER_DAY).map(t => (
                  <button key={t.id} type="button" onClick={() => onOpen(t)} title={t.title} className={`w-full truncate text-left px-1.5 py-0.5 rounded border text-[10px] font-medium ${DOT[t.status]} hover:brightness-125 transition`}>
                    {t.title}
                  </button>
                ))}
                {list.length > MAX_PER_DAY && <span className="text-[10px] text-on-surface-variant px-1">+{list.length - MAX_PER_DAY} más</span>}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Sin fecha límite ({undated.length})</h3>
          <div className="flex flex-wrap gap-2">
            {undated.map(t => (
              <button key={t.id} type="button" onClick={() => onOpen(t)} className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${DOT[t.status]} hover:brightness-125 transition`}>{t.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
