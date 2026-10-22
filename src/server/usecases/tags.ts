import { z } from 'zod'
import type { Db } from '@/server/db'
import * as svc from '@/server/services/tags'
import { parseId, uuid } from './common'

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido.')
const name = z.string().trim().min(1, 'El nombre es obligatorio.').max(50)
const createSchema = z.object({ name, color: color.optional(), parent_id: uuid.nullish() })
const updateSchema = z.object({ name: name.optional(), color: color.optional() })

export const listTags = (db: Db, userId: string, teamId: string) => svc.listTags(db, userId, parseId(teamId))

export async function createTag(db: Db, userId: string, teamId: string, input: unknown) {
  const { name, color, parent_id } = createSchema.parse(input)
  return svc.createTag(db, userId, parseId(teamId), { name, color, parent_id: parent_id ?? null })
}

export const updateTag = (db: Db, userId: string, tagId: string, patch: unknown) =>
  svc.updateTag(db, userId, parseId(tagId), updateSchema.parse(patch))

export const deleteTag = (db: Db, userId: string, tagId: string) => svc.deleteTag(db, userId, parseId(tagId))
