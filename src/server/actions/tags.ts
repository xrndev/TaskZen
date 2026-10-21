'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import * as svc from '@/server/services/tags'
import { run } from './run'

const id = z.uuid()
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido.')
const name = z.string().trim().min(1, 'El nombre es obligatorio.').max(50)

export async function listTagsAction(teamId: string) {
  return run((u) => svc.listTags(db, u, id.parse(teamId)))
}

export async function createTagAction(teamId: string, input: { name: string; color?: string; parent_id?: string | null }) {
  return run((u) =>
    svc.createTag(db, u, id.parse(teamId), {
      name: name.parse(input.name),
      color: input.color === undefined ? undefined : color.parse(input.color),
      parent_id: input.parent_id ? id.parse(input.parent_id) : null,
    }),
  )
}

export async function updateTagAction(tagId: string, patch: { name?: string; color?: string }) {
  return run((u) =>
    svc.updateTag(db, u, id.parse(tagId), {
      name: patch.name === undefined ? undefined : name.parse(patch.name),
      color: patch.color === undefined ? undefined : color.parse(patch.color),
    }),
  )
}

export async function deleteTagAction(tagId: string) {
  return run((u) => svc.deleteTag(db, u, id.parse(tagId)))
}
