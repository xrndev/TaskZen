import { z } from 'zod'
import type { Db } from '@/server/db'
import * as svc from '@/server/services/columns'
import { parseId, uuid } from './common'

const kind = z.enum(['pending', 'in_progress', 'completed'])
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido.')
const createSchema = z.object({ name: z.string().max(40), kind, color: color.nullish() })
const updateSchema = z.object({ name: z.string().max(40).nullable().optional(), color: color.nullable().optional(), kind: kind.optional() })
const shiftSchema = z.object({ direction: z.union([z.literal(-1), z.literal(1)]) })
const deleteSchema = z.object({ moveTo: uuid.nullish() })

export const listColumns = (db: Db, userId: string, teamId: string) => svc.listColumns(db, userId, parseId(teamId))

export async function createColumn(db: Db, userId: string, teamId: string, input: unknown) {
  return svc.createColumn(db, userId, parseId(teamId), createSchema.parse(input))
}

export const updateColumn = (db: Db, userId: string, columnId: string, patch: unknown) =>
  svc.updateColumn(db, userId, parseId(columnId), updateSchema.parse(patch))

export const shiftColumn = (db: Db, userId: string, columnId: string, input: unknown) =>
  svc.shiftColumn(db, userId, parseId(columnId), shiftSchema.parse(input).direction)

export const deleteColumn = (db: Db, userId: string, columnId: string, input: unknown) =>
  svc.deleteColumn(db, userId, parseId(columnId), deleteSchema.parse(input ?? {}).moveTo ?? null)
