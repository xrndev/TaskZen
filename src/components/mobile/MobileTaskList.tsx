'use client';

import { useMemo, useState } from 'react';
import { useNow } from '@/lib/useNow';
import type { Task, TaskStatus, TeamRole } from '@/types';
import { TaskActionSheet } from './MobileBoard';
import { MobileTaskCard } from './MobileTaskCard';

/** Vista de lista en móvil: tarjetas ordenadas por fecha límite (las que no tienen, al final). */
export function MobileTaskList({ tasks, userId, role, onOpen, onMove, onDelete }: {
  tasks: Task[];
  userId: string;
  role: TeamRole;
  onOpen: (t: Task) => void;
  onMove: (t: Task, s: TaskStatus) => void;
  onDelete: (t: Task) => void;
}) {
  const now = useNow();
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => (a.due_date ? Date.parse(a.due_date) : Infinity) - (b.due_date ? Date.parse(b.due_date) : Infinity)),
    [tasks],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-32 lg:hidden">
      <p className="mb-3 text-sm text-on-surface/80" aria-live="polite">{sorted.length} {sorted.length === 1 ? 'tarea' : 'tareas'}, por fecha límite</p>
      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-outline-variant/30 p-8 text-center text-sm text-on-surface/80">No hay tareas que coincidan con los filtros.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((t) => (
            <li key={t.id}><MobileTaskCard task={t} now={now} showStatus onOpen={onOpen} onMenu={setMenuTask} /></li>
          ))}
        </ul>
      )}
      <TaskActionSheet task={menuTask} onClose={() => setMenuTask(null)} userId={userId} role={role} onOpen={onOpen} onMove={onMove} onDelete={onDelete} />
    </div>
  );
}
