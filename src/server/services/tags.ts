import { asc, eq } from 'drizzle-orm'
import { tags } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { Tag } from '@/types'
import { notifyTeam, requireRole, ServiceError } from './common'

const COLOR = /^#[0-9a-fA-F]{6}$/

export async function listTags(db: Db, userId: string, teamId: string): Promise<Tag[]> {
  await requireRole(db, userId, teamId)
  return db.select().from(tags).where(eq(tags.team_id, teamId)).orderBy(asc(tags.created_at))
}

export async function createTag(
  db: Db,
  userId: string,
  teamId: string,
  input: { name: string; color?: string; parent_id?: string | null },
): Promise<Tag> {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'tag:create')) throw new ServiceError('FORBIDDEN', 'No puedes crear etiquetas.')
  const name = input.name.trim()
  if (!name) throw new ServiceError('INVALID', 'El nombre de la etiqueta es obligatorio.')
  const color = input.color ?? '#3b82f6'
  if (!COLOR.test(color)) throw new ServiceError('INVALID', 'Color no válido.')

  if (input.parent_id) {
    const [parent] = await db.select({ team_id: tags.team_id }).from(tags).where(eq(tags.id, input.parent_id))
    if (!parent || parent.team_id !== teamId) throw new ServiceError('INVALID', 'La etiqueta padre no pertenece al equipo.')
  }
  const [tag] = await db
    .insert(tags)
    .values({ team_id: teamId, user_id: userId, name, color, parent_id: input.parent_id ?? null })
    .returning()
  await notifyTeam(db, teamId)
  return tag
}

async function loadManageable(db: Db, userId: string, tagId: string) {
  const [tag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1)
  if (!tag) throw new ServiceError('NOT_FOUND', 'Etiqueta no encontrada.')
  const role = await requireRole(db, userId, tag.team_id).catch(() => {
    throw new ServiceError('NOT_FOUND', 'Etiqueta no encontrada.')
  })
  if (!can(userId, role, 'tag:manage', { ownerId: tag.user_id })) {
    throw new ServiceError('FORBIDDEN', 'No puedes modificar esta etiqueta.')
  }
  return tag
}

export async function updateTag(db: Db, userId: string, tagId: string, patch: { name?: string; color?: string }) {
  const tag = await loadManageable(db, userId, tagId)
  const set: Partial<typeof tags.$inferInsert> = {}
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new ServiceError('INVALID', 'El nombre de la etiqueta es obligatorio.')
    set.name = patch.name.trim()
  }
  if (patch.color !== undefined) {
    if (!COLOR.test(patch.color)) throw new ServiceError('INVALID', 'Color no válido.')
    set.color = patch.color
  }
  if (Object.keys(set).length) await db.update(tags).set(set).where(eq(tags.id, tagId))
  await notifyTeam(db, tag.team_id)
}

export async function deleteTag(db: Db, userId: string, tagId: string) {
  const tag = await loadManageable(db, userId, tagId)
  await db.delete(tags).where(eq(tags.id, tagId))
  await notifyTeam(db, tag.team_id)
}
