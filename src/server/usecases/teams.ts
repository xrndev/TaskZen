import { z } from 'zod'
import type { Db } from '@/server/db'
import * as invites from '@/server/services/invites'
import * as svc from '@/server/services/teams'
import { parseId, roleSchema } from './common'

const teamSchema = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio.').max(80) })
const memberSchema = z.object({ email: z.email('Correo no válido.'), role: roleSchema.default('member') })
const linkSchema = z.object({ role: z.enum(['product_owner', 'member']).default('member') })
const roleBodySchema = z.object({ role: roleSchema })
const userIdSchema = z.string().min(1)

export const listTeams = (db: Db, userId: string) => svc.listTeams(db, userId)
export const createTeam = (db: Db, userId: string, input: unknown) => svc.createTeam(db, userId, teamSchema.parse(input).name)
export const deleteTeam = (db: Db, userId: string, teamId: string) => svc.deleteTeam(db, userId, parseId(teamId))

export const listMembers = (db: Db, userId: string, teamId: string) => svc.listMembers(db, userId, parseId(teamId))

/** Añade a alguien que ya tiene cuenta, por su correo. */
export async function addMember(db: Db, userId: string, teamId: string, input: unknown) {
  const { email, role } = memberSchema.parse(input)
  await svc.inviteMember(db, userId, parseId(teamId), email, role)
}

export const removeMember = (db: Db, userId: string, teamId: string, targetId: string) =>
  svc.removeMember(db, userId, parseId(teamId), userIdSchema.parse(targetId))

export const changeMemberRole = (db: Db, userId: string, teamId: string, targetId: string, input: unknown) =>
  svc.updateMemberRole(db, userId, parseId(teamId), userIdSchema.parse(targetId), roleBodySchema.parse(input).role)

/* Enlaces de invitación */
export const createInvite = (db: Db, userId: string, teamId: string, input: unknown) =>
  invites.createInvite(db, userId, parseId(teamId), linkSchema.parse(input).role)
export const listInvites = (db: Db, userId: string, teamId: string) => invites.listInvites(db, userId, parseId(teamId))
export const revokeInvite = (db: Db, userId: string, inviteId: string) => invites.revokeInvite(db, userId, parseId(inviteId))
export const acceptInvite = (db: Db, userId: string, token: unknown) => invites.acceptInvite(db, userId, z.string().min(10).max(100).parse(token))
