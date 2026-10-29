'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { Subtask } from '@/types'
import { createSubtask, deleteSubtask, fetchSubtasks, updateSubtask } from '@/lib/api'
import { useT } from '@/lib/i18n/client'

/** Lista de comprobación de una tarea: marcar, añadir y borrar pasos. `onChange` avisa para refrescar el contador de la tarjeta. */
export function Subtasks({ taskId, canEdit, onChange }: { taskId: string; canEdit: boolean; onChange?: () => void }) {
  const t = useT()
  const [items, setItems] = useState<Subtask[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => setItems(await fetchSubtasks(taskId)), [taskId])
  useEffect(() => {
    let alive = true
    fetchSubtasks(taskId).then((list) => alive && setItems(list))
    return () => { alive = false }
  }, [taskId])

  const done = items.filter((i) => i.done).length

  async function add() {
    const title = text.trim()
    if (!title || busy) return
    setBusy(true)
    const created = await createSubtask(taskId, title)
    if (created) {
      setItems((prev) => [...prev, created])
      setText('')
      onChange?.()
    }
    setBusy(false)
  }

  async function toggle(item: Subtask) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
    const ok = await updateSubtask(item.id, { done: !item.done })
    if (!ok) await load() // el servidor no lo aceptó: vuelve al estado real
    else onChange?.()
  }

  async function remove(item: Subtask) {
    const ok = await deleteSubtask(item.id)
    if (ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      onChange?.()
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-label={t('subtasks.title')}>
      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
        <h3 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">{t('subtasks.title')}</h3>
        {items.length > 0 && <span className="text-[10px] font-bold text-on-surface-variant">{done}/{items.length}</span>}
      </div>

      {items.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label={t('subtasks.progress')}>
          <div className="h-full rounded-full bg-tertiary transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-surface-container-low">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.title}
              disabled={!canEdit}
              onClick={() => void toggle(item)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors max-lg:h-7 max-lg:w-7 ${item.done ? 'border-tertiary bg-tertiary text-black' : 'border-outline-variant/60'} disabled:opacity-60`}
            >
              {item.done && <Check className="h-3.5 w-3.5" aria-hidden />}
            </button>
            <span className={`flex-1 text-sm ${item.done ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{item.title}</span>
            {canEdit && (
              <button type="button" onClick={() => void remove(item)} aria-label={t('subtasks.delete', { title: item.title })} className="text-on-surface-variant/60 opacity-0 transition-opacity hover:text-error focus:opacity-100 group-hover:opacity-100 max-lg:opacity-100 max-lg:min-h-11 max-lg:min-w-11 max-lg:flex max-lg:items-center max-lg:justify-center">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm italic text-on-surface-variant/50">{t('subtasks.empty')}</li>}
      </ul>

      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); void add() }} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder={t('subtasks.placeholder')}
            aria-label={t('subtasks.new')}
            className="min-w-0 flex-1 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-primary/50 focus:outline-none max-lg:min-h-11"
          />
          <button type="submit" disabled={busy || !text.trim()} className="flex items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-black disabled:opacity-50 max-lg:min-h-11">
            <Plus className="h-4 w-4" aria-hidden /> {t('common.add')}
          </button>
        </form>
      )}
    </section>
  )
}
