import type { BoardColumn, Task, TaskStatus } from '@/types'
import type { T } from './i18n/core'

/** Una columna lista para pintar: el nombre ya está en el idioma de quien mira. */
export interface ColumnView {
  id: string
  label: string
  kind: TaskStatus
  /** Color elegido (#rrggbb); sin él se usa el del tipo. */
  hex: string | null
}

export const KIND_DOT: Record<TaskStatus, string> = { pending: 'bg-secondary', in_progress: 'bg-primary', completed: 'bg-tertiary' }
export const KIND_BADGE: Record<TaskStatus, string> = {
  pending: 'bg-secondary/15 text-secondary border-secondary/30',
  in_progress: 'bg-primary/15 text-primary border-primary/30',
  completed: 'bg-tertiary/15 text-tertiary border-tertiary/30',
}
export const KIND_ORDER: Record<TaskStatus, number> = { pending: 0, in_progress: 1, completed: 2 }

/** Las tres de serie no tienen nombre propio: se muestran con el nombre de su tipo en el idioma actual. */
export function columnViews(columns: BoardColumn[], t: T): ColumnView[] {
  return columns.map((c) => ({ id: c.id, label: c.name ?? t(`status.${c.kind}`), kind: c.kind, hex: c.color }))
}

/** La columna de una tarea; las antiguas sin columna van a la primera de su estado (o a la primera del tablero). */
export function viewOf(task: Task, views: ColumnView[]): ColumnView | undefined {
  return views.find((v) => v.id === task.column_id) ?? views.find((v) => v.kind === task.status) ?? views[0]
}

export const columnIdOf = (task: Task, views: ColumnView[]): string | undefined => viewOf(task, views)?.id
