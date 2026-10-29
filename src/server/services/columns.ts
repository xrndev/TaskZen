import { and, asc, count, eq, isNull, max, min, sql } from 'drizzle-orm'
import { boardColumns, tasks } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { BoardColumn, TaskStatus } from '@/types'
import { assertCanAddColumn } from './billing'
import { notifyTeam, requireRole, roleIn, ServiceError } from './common'

const STEP = 1000
const COLOR = /^#[0-9a-fA-F]{6}$/
/** Tope técnico, por encima de cualquier plan. */
export const MAX_COLUMNS = 12
const DEFAULT_KINDS: TaskStatus[] = ['pending', 'in_progress', 'completed']

const toColumn = (r: typeof boardColumns.$inferSelect): BoardColumn => ({
  id: r.id, team_id: r.team_id, name: r.name, kind: r.kind, color: r.color, position: r.position,
})

/**
 * Las columnas del equipo, en orden. Si no tiene ninguna (equipo nuevo o anterior a las columnas) crea las tres de serie
 * y coloca en ellas las tareas que aún no tenían columna.
 */
export async function ensureColumns(db: Db, teamId: string): Promise<BoardColumn[]> {
  let rows = await db.select().from(boardColumns).where(eq(boardColumns.team_id, teamId)).orderBy(asc(boardColumns.position), asc(boardColumns.created_at))
  if (rows.length === 0) {
    rows = await db
      .insert(boardColumns)
      .values(DEFAULT_KINDS.map((kind, i) => ({ team_id: teamId, kind, position: (i + 1) * STEP })))
      .returning()
    rows.sort((a, b) => a.position - b.position)
  }
  await db
    .update(tasks)
    .set({
      column_id: sql`(select c.id from ${boardColumns} c where c.team_id = ${tasks.team_id} and c.kind = ${tasks.status} order by c.position limit 1)`,
    })
    .where(and(eq(tasks.team_id, teamId), isNull(tasks.column_id)))
  return rows.map(toColumn)
}

export async function listColumns(db: Db, userId: string, teamId: string): Promise<BoardColumn[]> {
  await requireRole(db, userId, teamId)
  return ensureColumns(db, teamId)
}

function cleanName(name: string) {
  const clean = name.trim()
  if (!clean) throw new ServiceError('INVALID', 'El nombre de la columna es obligatorio.')
  if (clean.length > 40) throw new ServiceError('INVALID', 'El nombre de la columna admite hasta 40 caracteres.')
  return clean
}

export async function createColumn(
  db: Db, userId: string, teamId: string, input: { name: string; kind: TaskStatus; color?: string | null },
): Promise<BoardColumn> {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'column:manage')) throw new ServiceError('FORBIDDEN', 'Solo administradores y product owners pueden cambiar las columnas.')
  const name = cleanName(input.name)
  if (input.color && !COLOR.test(input.color)) throw new ServiceError('INVALID', 'Color no válido.')
  const existing = await ensureColumns(db, teamId)
  if (existing.length >= MAX_COLUMNS) throw new ServiceError('INVALID', `Un tablero admite hasta ${MAX_COLUMNS} columnas.`)
  await assertCanAddColumn(db, teamId, existing.length)

  const [row] = await db
    .insert(boardColumns)
    .values({ team_id: teamId, name, kind: input.kind, color: input.color ?? null, position: Math.max(...existing.map((c) => c.position)) + STEP })
    .returning()
  await notifyTeam(db, teamId)
  return toColumn(row)
}

async function loadManageable(db: Db, userId: string, columnId: string) {
  const [col] = await db.select().from(boardColumns).where(eq(boardColumns.id, columnId)).limit(1)
  if (!col) throw new ServiceError('NOT_FOUND', 'Columna no encontrada.')
  const role = await roleIn(db, userId, col.team_id)
  if (!role) throw new ServiceError('NOT_FOUND', 'Columna no encontrada.')
  if (!can(userId, role, 'column:manage')) throw new ServiceError('FORBIDDEN', 'Solo administradores y product owners pueden cambiar las columnas.')
  return col
}

export async function updateColumn(
  db: Db, userId: string, columnId: string, patch: { name?: string | null; color?: string | null; kind?: TaskStatus },
) {
  const col = await loadManageable(db, userId, columnId)
  const set: Partial<typeof boardColumns.$inferInsert> = {}
  if (patch.name !== undefined) {
    // `null` devuelve la columna al nombre traducido de su tipo («Pendiente», «En curso», «Hecha»).
    set.name = patch.name === null ? null : cleanName(patch.name)
  }
  if (patch.color !== undefined) {
    if (patch.color && !COLOR.test(patch.color)) throw new ServiceError('INVALID', 'Color no válido.')
    set.color = patch.color || null
  }
  if (patch.kind !== undefined) set.kind = patch.kind

  await db.transaction(async (tx) => {
    if (Object.keys(set).length) await tx.update(boardColumns).set(set).where(eq(boardColumns.id, col.id))
    // El estado de las tareas siempre es el tipo de su columna.
    if (patch.kind !== undefined && patch.kind !== col.kind) {
      await tx.update(tasks).set({ status: patch.kind }).where(eq(tasks.column_id, col.id))
    }
  })
  await notifyTeam(db, col.team_id)
}

/** Sube (-1) o baja (+1) una columna intercambiando su sitio con la vecina. */
export async function shiftColumn(db: Db, userId: string, columnId: string, direction: -1 | 1) {
  const col = await loadManageable(db, userId, columnId)
  const all = await ensureColumns(db, col.team_id)
  const i = all.findIndex((c) => c.id === col.id)
  const other = all[i + direction]
  if (!other) return
  await db.transaction(async (tx) => {
    await tx.update(boardColumns).set({ position: other.position }).where(eq(boardColumns.id, col.id))
    await tx.update(boardColumns).set({ position: col.position }).where(eq(boardColumns.id, other.id))
  })
  await notifyTeam(db, col.team_id)
}

/** Borra una columna; sus tareas pasan a `moveToId` (obligatorio si tiene alguna). Siempre queda al menos una columna. */
export async function deleteColumn(db: Db, userId: string, columnId: string, moveToId?: string | null) {
  const col = await loadManageable(db, userId, columnId)
  const all = await ensureColumns(db, col.team_id)
  if (all.length <= 1) throw new ServiceError('INVALID', 'El tablero necesita al menos una columna.')

  const [{ n }] = await db.select({ n: count() }).from(tasks).where(eq(tasks.column_id, col.id))
  let target: BoardColumn | undefined
  if (n > 0) {
    target = all.find((c) => c.id === moveToId && c.id !== col.id)
    if (!target) throw new ServiceError('INVALID', 'Elige a qué columna se mueven las tareas de la que borras.')
  }

  await db.transaction(async (tx) => {
    if (target) {
      const [{ top }] = await tx.select({ top: max(tasks.position) }).from(tasks).where(eq(tasks.column_id, target.id))
      const [{ low }] = await tx.select({ low: min(tasks.position) }).from(tasks).where(eq(tasks.column_id, col.id))
      // Las tareas movidas conservan su orden y quedan detrás de las que ya había.
      const shift = (top ?? 0) - (low ?? 0) + STEP
      await tx
        .update(tasks)
        .set({ column_id: target.id, status: target.kind, position: sql`${tasks.position} + ${shift}` })
        .where(eq(tasks.column_id, col.id))
    }
    await tx.delete(boardColumns).where(eq(boardColumns.id, col.id))
  })
  await notifyTeam(db, col.team_id)
}

/** La columna donde cae una tarea nueva o movida «solo por estado» (la primera de ese tipo). */
export function firstColumnOfKind(columns: BoardColumn[], kind: TaskStatus): BoardColumn | undefined {
  return columns.find((c) => c.kind === kind)
}
