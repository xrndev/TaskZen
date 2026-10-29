'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, Trash2 } from 'lucide-react';
import { can } from '@/lib/permissions';
import { useNow } from '@/lib/useNow';
import type { Tag, Task, TeamRole } from '@/types';
import { columnIdOf, KIND_DOT, type ColumnView } from '@/lib/columns';
import { useT } from '@/lib/i18n/client';
import { BottomSheet } from './BottomSheet';
import { MobileTaskCard } from './MobileTaskCard';

interface Props {
  /** Tareas ya filtradas por búsqueda, responsable, fecha y etiquetas. */
  tasks: Task[];
  groupBy: 'status' | 'tag';
  allTags: Tag[];
  columns: ColumnView[];
  activeColumnId: string | null;
  onActiveColumn: (id: string) => void;
  userId: string;
  role: TeamRole;
  onOpen: (t: Task) => void;
  onMove: (t: Task, columnId: string) => void;
  onDelete: (t: Task) => void;
}

/** Menú de acciones de una tarea: es también la alternativa a arrastrar para mover tarjetas. */
export function TaskActionSheet({ task, columns, onClose, userId, role, onOpen, onMove, onDelete }: Pick<Props, 'userId' | 'role' | 'onOpen' | 'onMove' | 'onDelete' | 'columns'> & { task: Task | null; onClose: () => void }) {
  const t = useT();
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
          <ExternalLink className="h-5 w-5 text-on-surface-variant" aria-hidden /> {t('task.open')}
        </button>

        {canMove && (
          <>
            <p className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('task.moveTo')}</p>
            {columns.filter((c) => c.id !== columnIdOf(task, columns)).map((c) => (
              <button key={c.id} type="button" className={`${row} text-on-surface`} onClick={() => { close(); onMove(task, c.id); }}>
                <span className={`h-3 w-3 rounded-full ${c.hex ? '' : KIND_DOT[c.kind]}`} style={c.hex ? { backgroundColor: c.hex } : undefined} aria-hidden />
                <span className="flex-1">{c.label}</span>
                <ArrowRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
              </button>
            ))}
          </>
        )}

        {canDelete && (
          <div className="mt-3 border-t border-outline-variant/15 pt-3">
            {confirming ? (
              <div role="alert" className="rounded-xl border border-error/30 bg-error/10 p-3">
                <p className="text-sm text-on-surface">{t('task.confirmDelete')}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirming(false)} className="min-h-12 rounded-xl border border-outline-variant/30 text-sm font-semibold text-on-surface">{t('common.cancel')}</button>
                  <button type="button" onClick={() => { close(); onDelete(task); }} className="min-h-12 rounded-xl bg-error text-sm font-bold text-white">{t('task.confirmYes')}</button>
                </div>
              </div>
            ) : (
              <button type="button" className={`${row} text-error`} onClick={() => setConfirming(true)}>
                <Trash2 className="h-5 w-5" aria-hidden /> {t('task.delete')}
              </button>
            )}
          </div>
        )}

        {!canMove && !canDelete && <p className="px-3 py-2 text-sm text-on-surface-variant">{t('task.readOnly')}</p>}
      </div>
    </BottomSheet>
  );
}

export function MobileBoard(props: Props) {
  const { tasks, groupBy, allTags, columns, activeColumnId, onActiveColumn, onOpen } = props;
  const t = useT();
  const now = useNow();
  const [menuTask, setMenuTask] = useState<Task | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const task of tasks) {
      const id = columnIdOf(task, columns);
      if (id) c.set(id, (c.get(id) ?? 0) + 1);
    }
    return c;
  }, [tasks, columns]);

  const swipe = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Solo un gesto claramente horizontal cambia de pestaña: no interfiere con el desplazamiento vertical.
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = columns.findIndex((c) => c.id === activeColumnId) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < columns.length) onActiveColumn(columns[i].id);
  };

  const card = (task: Task, showStatus: boolean) => (
    <li key={`${task.id}-${showStatus}`}><MobileTaskCard task={task} now={now} showStatus={showStatus} column={columns.find((c) => c.id === columnIdOf(task, columns))} onOpen={onOpen} onMenu={setMenuTask} /></li>
  );

  let body: React.ReactNode;
  if (groupBy === 'status') {
    const list = tasks.filter((task) => columnIdOf(task, columns) === activeColumnId);
    const activeLabel = columns.find((c) => c.id === activeColumnId)?.label ?? '';
    body = list.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-outline-variant/30 p-8 text-center text-sm text-on-surface/80">
        {t('board.noTasksIn', { name: activeLabel })}
      </p>
    ) : (
      <ul className="flex flex-col gap-3">{list.map((task) => card(task, false))}</ul>
    );
  } else {
    const groups = [
      ...allTags.map((tag) => ({ key: tag.id, name: tag.name, color: tag.color, items: tasks.filter((task) => task.tags?.some((x) => x.id === tag.id)) })),
      { key: 'none', name: t('board.noTag'), color: '', items: tasks.filter((task) => !task.tags || task.tags.length === 0) },
    ].filter((g) => g.items.length > 0);
    body = groups.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-outline-variant/30 p-8 text-center text-sm text-on-surface/80">{t('board.noMatches')}</p>
    ) : (
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-label={g.name}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-on-surface">
              {g.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />}
              {g.name}
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-semibold text-on-surface/80">{g.items.length}</span>
            </h3>
            <ul className="flex flex-col gap-3">{g.items.map((task) => card(task, true))}</ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:hidden">
      {groupBy === 'status' && (
        <div role="tablist" aria-label={t('board.statusTabs')} className="flex shrink-0 gap-1 overflow-x-auto border-b border-outline-variant/15 bg-surface px-3 py-2">
          {columns.map((c) => {
            const on = c.id === activeColumnId;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                id={`tab-${c.id}`}
                aria-selected={on}
                aria-controls="mobile-board-panel"
                onClick={() => onActiveColumn(c.id)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${on ? 'bg-primary text-black' : 'text-on-surface/80 hover:bg-surface-container-high'}`}
              >
                <span className="whitespace-nowrap">{c.label}</span>
                <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-black/15' : 'bg-surface-container-high'}`}>{counts.get(c.id) ?? 0}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        id="mobile-board-panel"
        role={groupBy === 'status' ? 'tabpanel' : 'region'}
        aria-labelledby={groupBy === 'status' && activeColumnId ? `tab-${activeColumnId}` : undefined}
        aria-label={groupBy === 'tag' ? t('board.byTag') : undefined}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={swipe}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-32"
      >
        {body}
      </div>

      <TaskActionSheet task={menuTask} columns={columns} onClose={() => setMenuTask(null)} userId={props.userId} role={props.role} onOpen={onOpen} onMove={props.onMove} onDelete={props.onDelete} />
    </div>
  );
}
