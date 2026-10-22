'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/teams'
import { run } from './run'

export async function listTeamsAction() {
  return run((u) => uc.listTeams(db, u))
}
export async function listMembersAction(teamId: string) {
  return run((u) => uc.listMembers(db, u, teamId))
}
export async function createTeamAction(name: string) {
  return run((u) => uc.createTeam(db, u, { name }))
}
export async function inviteMemberAction(teamId: string, email: string, role: string = 'member') {
  return run((u) => uc.addMember(db, u, teamId, { email, role }))
}
export async function removeMemberAction(teamId: string, userId: string) {
  return run((u) => uc.removeMember(db, u, teamId, userId))
}
export async function updateMemberRoleAction(teamId: string, userId: string, role: string) {
  return run((u) => uc.changeMemberRole(db, u, teamId, userId, { role }))
}
export async function deleteTeamAction(teamId: string) {
  return run((u) => uc.deleteTeam(db, u, teamId))
}
