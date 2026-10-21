'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, Trash2 } from 'lucide-react';
import { can } from '@/lib/permissions';
import { useNow } from '@/lib/useNow';
import type { Tag, Task, TaskStatus, TeamRole } from '@/types';
import { BottomSheet } from './BottomSheet';
import { MobileTaskCard, STATUS_LABEL } from './MobileTaskCard';

export const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed'];
const DOT: Record<TaskStatus, string> = { pending: 'bg-secondary', in_progress: 'bg-primary', completed: 'bg-tertiary' };

interface Props {
  /** Tareas ya filtradas por búsqueda, responsable, fecha y etiquetas. */
  tasks: Task[];
  groupBy: 'status' | 'tag';
  allTags: Tag[];
  activeStatus: TaskStatus;
  onActiveStatus: (s: TaskStatus) => void;
  userId: string;
  role: TeamRole;
  onOpen: (t: Task) => void;
  onMove: (t: Task, status: TaskStatus) => void;
  onDelete: (t: Task) => void;
}

/** Menú de acciones de una tarea: es también la alternativa a arrastrar para mover tarjetas. */
export function TaskActionSheet({ task, onClose, userId, role, onOpen, onMove, onDelete }: Pick<Props, 'userId' | 'role' | 'onOpen' | 'onMove' | 'onDelete'> & { task: Task | null; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const close = () => { setConfirming(false); onClose(); };
  if (!task) return <BottomSheet open={false} onClose={close} title="">{null}</BottomSheet>;

  const res = { ownerId: task.user_id, assignedTo: task.assigned_to };
  const canMove = can(userId, role, 'task:move', res);
  const canDelete = can(userId, role, 'task:delete', res);
  const row = 'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary';

  return (
    <BottomSheet open onClose={close} title={task.title}>
      <div className="flex flex-col gap-1">
        <button type="button" className={`${row} text-on-surface`} onClick={() => { close(); onOpen(task); }}>
          <ExternalLink className="h-5 w-5 text-on-surface-variant" aria-hidden /> Abrir tarea
        </button>

        {canMove && (
          <>
            <p className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Mover a</p>
            {STATUSES.filter((s) => s !== task.status).map((s) => (
              <button key={s} type="button" className={`${row} text-on-surface`} onClick={() => { close(); onMove(task, s); }}>
                <span className={`h-3 w-3 rounded-full ${DOT[s]}`} aria-hidden />
                <span className="flex-1">{STATUS_LABEL[s]}</span>
                <ArrowRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
              </button>
            ))}
          </>
        )}

        {canDelete && (
          <div className="mt-3 border-t border-outline-variant/15 pt-3">
            {confirming ? (
              <div role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3">
                <p className="text-sm text-on-surface">¿Eliminar esta tarea? Se borrarán también sus comentarios y archivos.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirming(false)} className="min-h-12 rounded-xl border border-outline-variant/30 text-sm font-semibold text-on-surface">Cancelar</button>
                  <button type="button" onClick={() => { close(); onDelete(task); }} className="min-h-12 rounded-xl bg-error text-sm font-bold text-white">Sí, eliminar</button>
                </div>
              </div>
            ) : (
              <button type="button" className={`${row} text-error`} onClick={() => setConfirming(true)}>
                <Trash2 className="h-5 w-5" aria-hidden /> Eliminar tarea
              </button>
            )}
          </div>
        )}

        {!canMove && !canDelete && <p className="px-3 py-2 text-sm text-on-surface-variant">Solo puedes ver esta tarea. Pide a quien la creó o a un administrador que la modifique.</p>}
      </div>
    </BottomSheet>
  );
}

export function MobileBoard(props: Props) {
  const { tasks, groupBy, allTags, activeStatus, onActiveStatus, onOpen } = props;
  const now = useNow();
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = { pending: 0, in_progress: 0, completed: 0 };
    for (const t of tasks) c[t.status]++;
    return c;
  }, [tasks]);

  const swipe = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Solo un gesto claramente horizontal cambia de pestaña: no interfiere con el desplazamiento vertical.
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = STATUSES.indexOf(activeStatus) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < STATUSES.length) onActiveStatus(STATUSES[i]);
  };

  const card = (t: Task, showStatus: boolean) => (
    <li key={`${t.id}-${showStatus}`}><MobileTaskCard task={t} now={now} showStatus={showStatus} onOpen={onOpen} onMenu={setMenuTask} /></li>
  );

  let body: React.ReactNode;
  if (groupBy === 'status') {
    const list = tasks.filter((t) => t.status === activeStatus);
    body = list.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-outline-variant/30 p-8 text-center text-sm text-on-surface/80">
        No hay tareas en <strong>{STATUS_LABEL[activeStatus]}</strong>.
      </p>
    ) : (
      <ul className="flex flex-col gap-3">{list.map((t) => card(t, false))}</ul>
    );
  } else {
    const groups = [
      ...allTags.map((tag) => ({ key: tag.id, name: tag.name, color: tag.color, items: tasks.filter((t) => t.tags?.some((x) => x.id === tag.id)) })),
      { key: 'none', name: 'Sin etiqueta', color: '', items: tasks.filter((t) => !t.tags || t.tags.length === 0) },
    ].filter((g) => g.items.length > 0);
    body = groups.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-outline-variant/30 p-8 text-center text-sm text-on-surface/80">No hay tareas que coincidan con los filtros.</p>
    ) : (
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.name}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-on-surface">
              {g.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />}
              {g.name}
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface/80">{g.items.length}</span>
            </h3>
            <ul className="flex flex-col gap-3">{g.items.map((t) => card(t, true))}</ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:hidden">
      {groupBy === 'status' && (
        <div role="tablist" aria-label="Estado de las tareas" className="flex shrink-0 gap-1 border-b border-outline-variant/15 bg-surface px-3 py-2">
          {STATUSES.map((s) => {
            const on = s === activeStatus;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                id={`tab-${s}`}
                aria-selected={on}
                aria-controls="mobile-board-panel"
                onClick={() => onActiveStatus(s)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-1 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${on ? 'bg-primary text-black' : 'text-on-surface/80 hover:bg-surface-container-high'}`}
              >
                <span className="whitespace-nowrap">{STATUS_LABEL[s]}</span>
                <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-black/15' : 'bg-surface-container-high'}`}>{counts[s]}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        id="mobile-board-panel"
        role={groupBy === 'status' ? 'tabpanel' : 'region'}
        aria-labelledby={groupBy === 'status' ? `tab-${activeStatus}` : undefined}
        aria-label={groupBy === 'tag' ? 'Tareas por etiqueta' : undefined}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={swipe}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-32"
      >
        {body}
      </div>

      <TaskActionSheet task={menuTask} onClose={() => setMenuTask(null)} userId={props.userId} role={props.role} onOpen={onOpen} onMove={props.onMove} onDelete={props.onDelete} />
    </div>
  );
}
