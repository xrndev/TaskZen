'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, Trash2, X } from 'lucide-react'
import type { BoardColumn, Task, TaskStatus } from '@/types'
import { createColumn, deleteColumn, shiftColumn, updateColumn } from '@/lib/api'
import { KIND_DOT } from '@/lib/columns'
import { useT } from '@/lib/i18n/client'

const KINDS: TaskStatus[] = ['pending', 'in_progress', 'completed']
const field = 'min-h-10 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none'

/**
 * Gestiona las columnas del tablero: renombrar, cambiar tipo y color, ordenar, añadir y borrar. El límite de columnas
 * lo aplica el servidor según el plan; al alcanzarlo se abre el diálogo de mejora.
 */
export function ColumnsDialog({
  isOpen, onClose, teamId, columns, tasks, canManage, onChanged,
}: {
  isOpen: boolean
  onClose: () => void
  teamId: string | null
  columns: BoardColumn[]
  tasks: Task[]
  canManage: boolean
  onChanged: () => Promise<void>
}) {
  const t = useT()
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<TaskStatus>('in_progress')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const label = (c: BoardColumn) => c.name ?? t(`status.${c.kind}`)
  const countIn = (c: BoardColumn) => tasks.filter((x) => (x.column_id ?? columns.find((k) => k.kind === x.status)?.id) === c.id).length

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    await action()
    await onChanged()
    setBusy(false)
  }

  async function rename(c: BoardColumn, value: string) {
    const clean = value.trim()
    if (clean === label(c)) return
    // Vaciar el campo devuelve la columna a su nombre original.
    await run(() => updateColumn(c.id, { name: clean === '' ? null : clean }))
  }

  async function add() {
    if (!teamId || !newName.trim()) return
    await run(async () => {
      const created = await createColumn(teamId, { name: newName, kind: newKind })
      if (created) setNewName('')
    })
  }

  async function remove(c: BoardColumn) {
    const n = countIn(c)
    if (n > 0 && !moveTo) return
    await run(() => deleteColumn(c.id, n > 0 ? moveTo : null))
    setDeleting(null)
    setMoveTo('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={t('columns.dialogTitle')} className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl border border-outline-variant/30 bg-surface-container shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/10 p-4">
          <h2 className="text-lg font-bold text-on-surface">{t('columns.dialogTitle')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="min-h-11 min-w-11 text-on-surface-variant hover:text-on-surface"><X className="mx-auto h-5 w-5" aria-hidden /></button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <p className="text-sm text-on-surface-variant">{canManage ? t('columns.intro') : t('columns.onlyAdmins')}</p>

          <ul className="flex flex-col gap-3">
            {columns.map((c, i) => (
              <li key={c.id} className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${c.color ? '' : KIND_DOT[c.kind]}`} style={c.color ? { backgroundColor: c.color } : undefined} aria-hidden />
                  <input
                    key={`${c.id}-${label(c)}`}
                    defaultValue={label(c)}
                    disabled={!canManage || busy}
                    maxLength={40}
                    aria-label={t('columns.name')}
                    onBlur={(e) => void rename(c, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    className={`${field} min-w-0 flex-1`}
                  />
                  <select
                    value={c.kind}
                    disabled={!canManage || busy}
                    aria-label={t('columns.kind')}
                    onChange={(e) => void run(() => updateColumn(c.id, { kind: e.target.value as TaskStatus }))}
                    className={field}
                  >
                    {KINDS.map((k) => <option key={k} value={k}>{t(`columns.kind.${k}`)}</option>)}
                  </select>
                  <input
                    type="color"
                    value={c.color ?? '#6366f1'}
                    disabled={!canManage || busy}
                    aria-label={t('columns.color')}
                    onChange={(e) => void run(() => updateColumn(c.id, { color: e.target.value }))}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-outline-variant/30 bg-transparent p-1"
                  />
                  {canManage && (
                    <div className="ml-auto flex items-center">
                      <button type="button" disabled={busy || i === 0} onClick={() => void run(() => shiftColumn(c.id, -1))} aria-label={`${t('columns.moveUp')}: ${label(c)}`} className="min-h-10 min-w-10 text-on-surface-variant hover:text-primary disabled:opacity-30"><ArrowLeft className="mx-auto h-4 w-4" aria-hidden /></button>
                      <button type="button" disabled={busy || i === columns.length - 1} onClick={() => void run(() => shiftColumn(c.id, 1))} aria-label={`${t('columns.moveDown')}: ${label(c)}`} className="min-h-10 min-w-10 text-on-surface-variant hover:text-primary disabled:opacity-30"><ArrowRight className="mx-auto h-4 w-4" aria-hidden /></button>
                      <button type="button" disabled={busy || columns.length <= 1} onClick={() => { setDeleting(c.id); setMoveTo('') }} aria-label={t('columns.remove', { name: label(c) })} className="min-h-10 min-w-10 text-on-surface-variant hover:text-error disabled:opacity-30"><Trash2 className="mx-auto h-4 w-4" aria-hidden /></button>
                    </div>
                  )}
                </div>

                {deleting === c.id && (
                  <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-on-surface">
                    {countIn(c) > 0 && (
                      <>
                        <label htmlFor={`move-${c.id}`}>{t('columns.moveTasksTo', { n: countIn(c) })}</label>
                        <select id={`move-${c.id}`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={field}>
                          <option value="" disabled>—</option>
                          {columns.filter((o) => o.id !== c.id).map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
                        </select>
                      </>
                    )}
                    <button type="button" onClick={() => setDeleting(null)} className="min-h-10 rounded-lg border border-outline-variant/30 px-3 text-xs font-bold uppercase tracking-wider">{t('common.cancel')}</button>
                    <button type="button" disabled={busy || (countIn(c) > 0 && !moveTo)} onClick={() => void remove(c)} className="min-h-10 rounded-lg bg-error px-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50">{t('columns.confirmDelete')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {canManage && (
            <form onSubmit={(e) => { e.preventDefault(); void add() }} className="flex flex-wrap items-end gap-2 border-t border-outline-variant/10 pt-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor="new-column-name" className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t('columns.addTitle')}</label>
                <input id="new-column-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder={t('columns.namePlaceholder')} className={field} />
              </div>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as TaskStatus)} aria-label={t('columns.kind')} className={field}>
                {KINDS.map((k) => <option key={k} value={k}>{t(`columns.kind.${k}`)}</option>)}
              </select>
              <button type="submit" disabled={busy || !newName.trim()} className="min-h-10 rounded-lg bg-primary px-4 text-xs font-extrabold uppercase tracking-wider text-black disabled:opacity-50">{t('columns.add')}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
