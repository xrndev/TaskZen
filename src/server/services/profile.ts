import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { user } from '@/db/schema'
import type { Db } from '@/server/db'
import type { Profile } from '@/types'
import { profileColumns, ServiceError } from './common'

export async function getMe(db: Db, userId: string): Promise<Profile> {
  const [me] = await db.select(profileColumns).from(user).where(eq(user.id, userId))
  return me
}

export async function updateProfile(db: Db, userId: string, changes: { full_name?: string; avatar_url?: string | null }): Promise<Profile> {
  const set: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
  if (changes.full_name !== undefined) {
    set.name = z.string().trim().min(1, 'El nombre es obligatorio.').max(80).parse(changes.full_name)
  }
  if (changes.avatar_url !== undefined) {
    if (changes.avatar_url !== null && !/^(https:\/\/|\/api\/media\/avatars\/)/.test(changes.avatar_url)) {
      throw new ServiceError('INVALID', 'URL de avatar no válida.')
    }
    set.image = changes.avatar_url
  }
  await db.update(user).set(set).where(eq(user.id, userId))
  return getMe(db, userId)
}
