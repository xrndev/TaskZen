'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import * as svc from '@/server/services/teams'
import { run } from './run'

const id = z.uuid()
const role = z.enum(['admin', 'product_owner', 'member'])

export async function listTeamsAction() {
  return run((u) => svc.listTeams(db, u))
}

export async function listMembersAction(teamId: string) {
  return run((u) => svc.listMembers(db, u, id.parse(teamId)))
}

export async function createTeamAction(name: string) {
  return run((u) => svc.createTeam(db, u, z.string().trim().min(1, 'El nombre es obligatorio.').max(80).parse(name)))
}

export async function inviteMemberAction(teamId: string, email: string, r: string = 'member') {
  return run((u) => svc.inviteMember(db, u, id.parse(teamId), z.email('Correo no válido.').parse(email), role.parse(r)))
}

export async function removeMemberAction(teamId: string, userId: string) {
  return run((u) => svc.removeMember(db, u, id.parse(teamId), z.string().min(1).parse(userId)))
}

export async function updateMemberRoleAction(teamId: string, userId: string, r: string) {
  return run((u) => svc.updateMemberRole(db, u, id.parse(teamId), z.string().min(1).parse(userId), role.parse(r)))
}

export async function deleteTeamAction(teamId: string) {
  return run((u) => svc.deleteTeam(db, u, id.parse(teamId)))
}
