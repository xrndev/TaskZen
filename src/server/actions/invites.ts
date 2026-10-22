'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/teams'
import { run } from './run'

export async function createInviteAction(teamId: string, role: string) {
  return run((u) => uc.createInvite(db, u, teamId, { role }))
}
export async function listInvitesAction(teamId: string) {
  return run((u) => uc.listInvites(db, u, teamId))
}
export async function revokeInviteAction(inviteId: string) {
  return run((u) => uc.revokeInvite(db, u, inviteId))
}
export async function acceptInviteAction(token: string) {
  return run((u) => uc.acceptInvite(db, u, token))
}
