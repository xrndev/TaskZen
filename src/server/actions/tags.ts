'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/tags'
import { run } from './run'

export async function listTagsAction(teamId: string) {
  return run((u) => uc.listTags(db, u, teamId))
}
export async function createTagAction(teamId: string, input: { name: string; color?: string; parent_id?: string | null }) {
  return run((u) => uc.createTag(db, u, teamId, input))
}
export async function updateTagAction(tagId: string, patch: { name?: string; color?: string }) {
  return run((u) => uc.updateTag(db, u, tagId, patch))
}
export async function deleteTagAction(tagId: string) {
  return run((u) => uc.deleteTag(db, u, tagId))
}
