'use server'

import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'
import { user } from '@/db/schema'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { profileColumns, ServiceError } from '@/server/services/common'
import { saveUpload } from '@/server/storage'
import { run } from './run'

export async function getMeAction() {
  return run(async (u) => {
    const [me] = await db.select(profileColumns).from(user).where(eq(user.id, u))
    return me
  })
}

export async function updateProfileAction(changes: { full_name?: string; avatar_url?: string | null }) {
  return run(async (u) => {
    const set: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
    if (changes.full_name !== undefined) {
      const name = z.string().trim().min(1, 'El nombre es obligatorio.').max(80).parse(changes.full_name)
      set.name = name
    }
    if (changes.avatar_url !== undefined) {
      if (changes.avatar_url !== null && !/^(https:\/\/|\/api\/media\/avatars\/)/.test(changes.avatar_url)) {
        throw new ServiceError('INVALID', 'URL de avatar no válida.')
      }
      set.image = changes.avatar_url
    }
    await db.update(user).set(set).where(eq(user.id, u))
    const [me] = await db.select(profileColumns).from(user).where(eq(user.id, u))
    return me
  })
}

export async function uploadAvatarAction(form: FormData) {
  return run(async () => {
    const file = form.get('file')
    if (!(file instanceof File)) throw new ServiceError('INVALID', 'Falta el archivo.')
    const saved = await saveUpload(file, { dir: 'avatars', maxSize: 2 * 1024 * 1024, imagesOnly: true })
    return `/api/media/${saved.key}`
  })
}

/** Crea una contraseña para una cuenta que entró con un proveedor y aún no tiene ninguna. */
export async function setPasswordAction(newPassword: string) {
  return run(async () => {
    const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128).parse(newPassword)
    try {
      await auth.api.setPassword({ body: { newPassword: password }, headers: await headers() })
    } catch {
      throw new ServiceError('CONFLICT', 'No se pudo crear la contraseña. Puede que tu cuenta ya tenga una.')
    }
  })
}
