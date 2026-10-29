'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/columns'
import { run } from './run'

export async function listColumnsAction(teamId: string) {
  return run((u) => uc.listColumns(db, u, teamId))
}
export async function createColumnAction(teamId: string, input: { name: string; kind: string; color?: string | null }) {
  return run((u) => uc.createColumn(db, u, teamId, input))
}
export async function updateColumnAction(columnId: string, patch: { name?: string | null; color?: string | null; kind?: string }) {
  return run((u) => uc.updateColumn(db, u, columnId, patch))
}
export async function shiftColumnAction(columnId: string, direction: -1 | 1) {
  return run((u) => uc.shiftColumn(db, u, columnId, { direction }))
}
export async function deleteColumnAction(columnId: string, moveTo?: string | null) {
  return run((u) => uc.deleteColumn(db, u, columnId, { moveTo }))
}
