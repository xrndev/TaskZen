'use client';

import { useMemo, useState } from 'react';
import { useNow } from '@/lib/useNow';
import type { Task, TeamRole } from '@/types';
import { columnIdOf, type ColumnView } from '@/lib/columns';
import { useT } from '@/lib/i18n/client';
import { TaskActionSheet } from './MobileBoard';
import { MobileTaskCard } from './MobileTaskCard';

/** Vista de lista en móvil: tarjetas ordenadas por fecha límite (las que no tienen, al final). */
export function MobileTaskList({ tasks, columns, userId, role, onOpen, onMove, onDelete }: {
  tasks: Task[];
  columns: ColumnView[];
  userId: string;
  role: TeamRole;
  onOpen: (t: Task) => void;
  onMove: (t: Task, columnId: string) => void;
  onDelete: (t: Task) => void;
}) {
  const t = useT();
  const now = useNow();
  const [menuTask, setMenuTask] = useState<Task | null>(null);

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => (a.due_date ? Date.parse(a.due_date) : Infinity) - (b.due_date ? Date.parse(b.due_date) : Infinity)),
    [tasks],
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-32 lg:hidden">
      <p className="mb-3 text-sm text-on-surface/80" aria-live="polite">{sorted.length === 1 ? t('list.count.one', { n: 1 }) : t('list.count.many', { n: sorted.length })}</p>
      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-outline-variant/30 p-8 text-center text-sm text-on-surface/80">{t('board.noMatches')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((task) => (
            <li key={task.id}><MobileTaskCard task={task} now={now} showStatus column={columns.find((c) => c.id === columnIdOf(task, columns))} onOpen={onOpen} onMenu={setMenuTask} /></li>
          ))}
        </ul>
      )}
      <TaskActionSheet task={menuTask} columns={columns} onClose={() => setMenuTask(null)} userId={userId} role={role} onOpen={onOpen} onMove={onMove} onDelete={onDelete} />
    </div>
  );
}
