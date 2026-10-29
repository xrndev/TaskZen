'use client';

import { Calendar, CheckCircle2, MessageSquare, MoreVertical, Paperclip } from 'lucide-react';
import { fallbackAvatar } from '@/lib/avatar';
import type { Task } from '@/types';
import { KIND_BADGE, type ColumnView } from '@/lib/columns';
import { useT } from '@/lib/i18n/client';
import { TagBadge } from '../TagBadge';

/**
 * Tarjeta pensada para el dedo: toda la tarjeta abre la tarea, y las acciones (mover, borrar)
 * viven en un menú de 44 px en vez de arrastrar o de un icono de papelera siempre a la vista.
 * Es un <article> con dos botones hermanos (no hay controles dentro de controles).
 */
export function MobileTaskCard({
  task,
  now,
  showStatus = false,
  column,
  onOpen,
  onMenu,
}: {
  task: Task;
  now: number;
  showStatus?: boolean;
  /** La columna de la tarea, para rotularla cuando se muestra el estado. */
  column?: ColumnView;
  onOpen: (t: Task) => void;
  onMenu: (t: Task) => void;
}) {
  const t = useT();
  const overdue = !!task.due_date && task.status !== 'completed' && Date.parse(task.due_date) < now;

  return (
    <article className="relative rounded-2xl border border-outline-variant/20 bg-surface-container shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="block w-full rounded-2xl p-4 pr-14 text-left active:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"
      >
        {showStatus && column && (
          <span className={`mb-2 inline-block rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${KIND_BADGE[column.kind]}`}>
            {column.label}
          </span>
        )}
        <span className={`block text-base font-semibold leading-snug ${task.status === 'completed' ? 'text-on-surface/70 line-through' : 'text-on-surface'}`}>{task.title}</span>
        {task.description && <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-on-surface/80">{task.description}</span>}

        {task.tags && task.tags.length > 0 && (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {task.tags.map((t) => <TagBadge key={t.id} tag={t} />)}
          </span>
        )}

        <span className="mt-3 flex items-center gap-4 text-sm text-on-surface/80">
          {task.due_date && (
            <span className={`flex items-center gap-1.5 ${overdue ? 'font-semibold text-error' : ''}`}>
              <Calendar className="h-4 w-4" aria-hidden />
              <span className="sr-only">{overdue ? t('task.overdue') : t('task.due')}</span>
              {new Date(task.due_date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {(task.subtask_total ?? 0) > 0 && (
            <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" aria-hidden />{task.subtask_done}/{task.subtask_total}<span className="sr-only">{t('subtasks.badgeSr')}</span></span>
          )}
          {(task.comment_count ?? 0) > 0 && (
            <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" aria-hidden />{task.comment_count}<span className="sr-only">{t('task.commentsSr')}</span></span>
          )}
          {(task.attachment_count ?? 0) > 0 && (
            <span className="flex items-center gap-1"><Paperclip className="h-4 w-4" aria-hidden />{task.attachment_count}<span className="sr-only">{t('task.attachmentsSr')}</span></span>
          )}
          {task.assigned_to && (
            <span className="ml-auto flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={task.assignee?.avatar_url || fallbackAvatar(task.assigned_to)} alt="" className="h-6 w-6 rounded-full object-cover" />
              <span className="sr-only">{t('task.assignedTo', { name: task.assignee?.full_name ?? '' })}</span>
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onMenu(task)}
        aria-label={`Acciones de la tarea ${task.title}`}
        aria-haspopup="dialog"
        className="absolute right-1 top-1 grid h-12 w-12 place-items-center rounded-xl text-on-surface/80 hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary"
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>
    </article>
  );
}
