'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNow } from '@/lib/useNow';
import type { Task, TaskStatus } from '@/types';

const DOT: Record<TaskStatus, string> = {
  pending: 'bg-secondary/20 text-secondary border-secondary/30',
  in_progress: 'bg-primary/20 text-primary border-primary/30',
  completed: 'bg-tertiary/20 text-tertiary border-tertiary/30 line-through opacity-70',
};
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MAX_PER_DAY = 3;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function DesktopCalendar({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
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
    <div className="hidden lg:block flex-1 overflow-auto p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-on-surface first-letter:uppercase">{title}</h2>
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

const DOT_COLOR: Record<TaskStatus, string> = { pending: 'bg-secondary', in_progress: 'bg-primary', completed: 'bg-tertiary' };
const STATUS_TEXT: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };

/** Calendario para móvil: rejilla compacta con puntos por estado y, debajo, la agenda del día elegido. */
function MobileCalendar({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const now = useNow(3_600_000);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(() => dayKey(new Date()));

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

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const total = Math.ceil((offset + days) / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i - offset + 1));
  }, [cursor]);

  const today = dayKey(new Date(now));
  const title = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const move = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const dayTasks = byDay.get(selected) ?? [];
  const selectedDate = cells.find((d) => dayKey(d) === selected);

  const taskButton = (t: Task) => (
    <li key={t.id}>
      <button type="button" onClick={() => onOpen(t)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-2 text-left active:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
        <span className={`h-3 w-3 shrink-0 rounded-full ${DOT_COLOR[t.status]}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-base font-medium ${t.status === 'completed' ? 'text-on-surface/70 line-through' : 'text-on-surface'}`}>{t.title}</span>
          <span className="block text-sm text-on-surface/80">
            {STATUS_TEXT[t.status]}{t.due_date ? ` · ${new Date(t.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3 pb-32 lg:hidden">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="px-1 text-lg font-bold text-on-surface first-letter:uppercase" aria-live="polite">{title}</h2>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mes anterior" onClick={() => move(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
          <button type="button" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); setSelected(dayKey(n)); }} className="h-11 rounded-xl border border-outline-variant/20 bg-surface-container px-3 text-xs font-bold uppercase tracking-wider text-on-surface">Hoy</button>
          <button type="button" aria-label="Mes siguiente" onClick={() => move(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-outline-variant/20 bg-surface-container text-on-surface"><ChevronRight className="h-5 w-5" aria-hidden /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center" role="group" aria-label={`Calendario de ${title}`}>
        {WEEKDAYS.map((d) => <div key={d} aria-hidden className="py-1 text-xs font-bold uppercase text-on-surface/80">{d}</div>)}
        {cells.map((date) => {
          const k = dayKey(date);
          const list = byDay.get(k) ?? [];
          const inMonth = date.getMonth() === cursor.getMonth();
          const on = k === selected;
          const label = `${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${list.length === 0 ? 'sin tareas' : `${list.length} ${list.length === 1 ? 'tarea' : 'tareas'}`}`;
          return (
            <div key={k}>
              <button
                type="button"
                aria-label={label}
                aria-current={k === today ? 'date' : undefined}
                aria-pressed={on}
                onClick={() => { setSelected(k); if (!inMonth) setCursor(new Date(date.getFullYear(), date.getMonth(), 1)); }}
                className={`mx-auto flex h-12 w-full max-w-12 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${on ? 'bg-primary text-black' : k === today ? 'border border-primary text-primary' : inMonth ? 'text-on-surface hover:bg-surface-container-high' : 'text-on-surface/70'}`}
              >
                {date.getDate()}
                <span className="flex h-1.5 gap-0.5" aria-hidden>
                  {list.slice(0, 3).map((t) => <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-black/70' : DOT_COLOR[t.status]}`} />)}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <section className="mt-5" aria-live="polite">
        <h3 className="mb-2 text-sm font-bold text-on-surface first-letter:uppercase">
          {selectedDate ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Día seleccionado'}
        </h3>
        {dayTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant/30 p-4 text-sm text-on-surface/80">No hay tareas con fecha límite este día.</p>
        ) : (
          <ul className="flex flex-col gap-2">{dayTasks.map(taskButton)}</ul>
        )}
      </section>

      {undated.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-bold text-on-surface">Sin fecha límite ({undated.length})</h3>
          <ul className="flex flex-col gap-2">{undated.map(taskButton)}</ul>
        </section>
      )}
    </div>
  );
}

export function CalendarView(props: { tasks: Task[]; onOpen: (t: Task) => void }) {
  return (
    <>
      <DesktopCalendar {...props} />
      <MobileCalendar {...props} />
    </>
  );
}
