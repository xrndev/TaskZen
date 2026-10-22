'use server'

import { headers } from 'next/headers'
import { db } from '@/server/db'
import * as uc from '@/server/usecases/profile'
import { run } from './run'

export async function getMeAction() {
  return run((u) => uc.getMe(db, u))
}
export async function updateProfileAction(changes: { full_name?: string; avatar_url?: string | null }) {
  return run((u) => uc.updateProfile(db, u, changes))
}
export async function uploadAvatarAction(form: FormData) {
  return run(() => uc.uploadAvatar(form.get('file')))
}
export async function setPasswordAction(newPassword: string) {
  return run(async () => uc.setPassword(await headers(), { password: newPassword }))
}
