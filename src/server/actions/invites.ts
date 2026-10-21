'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import * as svc from '@/server/services/invites'
import { run } from './run'

const id = z.uuid()

export async function createInviteAction(teamId: string, role: string) {
  return run((u) => svc.createInvite(db, u, id.parse(teamId), z.enum(['product_owner', 'member']).parse(role)))
}

export async function listInvitesAction(teamId: string) {
  return run((u) => svc.listInvites(db, u, id.parse(teamId)))
}

export async function revokeInviteAction(inviteId: string) {
  return run((u) => svc.revokeInvite(db, u, id.parse(inviteId)))
}

export async function acceptInviteAction(token: string) {
  return run((u) => svc.acceptInvite(db, u, z.string().min(10).max(100).parse(token)))
}
