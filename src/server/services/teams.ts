import { and, asc, count, eq, sql } from 'drizzle-orm'
import { teamMembers, teams, user } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { Team, TeamMember, TeamRole } from '@/types'
import { profileColumns, requireRole, ServiceError } from './common'

export async function ensurePersonalTeam(db: Db, userId: string, displayName: string): Promise<Team> {
  const [existing] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.owner_id, userId), eq(teams.is_personal, true)))
    .limit(1)
  if (existing) return existing

  return db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ name: `Personal · ${displayName}`, owner_id: userId, is_personal: true })
      .returning()
    await tx.insert(teamMembers).values({ team_id: team.id, user_id: userId, role: 'admin' })
    return team
  })
}

export async function listTeams(db: Db, userId: string): Promise<Team[]> {
  const rows = await db
    .select({ team: teams })
    .from(teams)
    .innerJoin(teamMembers, eq(teamMembers.team_id, teams.id))
    .where(eq(teamMembers.user_id, userId))
    .orderBy(sql`${teams.is_personal} desc`, asc(teams.created_at))
  return rows.map((r) => r.team)
}

export async function createTeam(db: Db, userId: string, name: string): Promise<Team> {
  const clean = name.trim()
  if (!clean) throw new ServiceError('INVALID', 'El nombre del equipo es obligatorio.')
  return db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ name: clean, owner_id: userId }).returning()
    await tx.insert(teamMembers).values({ team_id: team.id, user_id: userId, role: 'admin' })
    return team
  })
}

export async function listMembers(db: Db, userId: string, teamId: string): Promise<TeamMember[]> {
  await requireRole(db, userId, teamId)
  const rows = await db
    .select({
      id: teamMembers.id,
      team_id: teamMembers.team_id,
      user_id: teamMembers.user_id,
      role: teamMembers.role,
      joined_at: teamMembers.joined_at,
      profile: profileColumns,
    })
    .from(teamMembers)
    .innerJoin(user, eq(user.id, teamMembers.user_id))
    .where(eq(teamMembers.team_id, teamId))
    .orderBy(asc(teamMembers.joined_at))
  return rows
}

async function requireAdmin(db: Db, userId: string, teamId: string) {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'team:manage_members')) {
    throw new ServiceError('FORBIDDEN', 'Solo un administrador puede gestionar miembros.')
  }
}

export async function inviteMember(db: Db, userId: string, teamId: string, email: string, role: TeamRole = 'member') {
  await requireAdmin(db, userId, teamId)
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1)
  if (!target) {
    throw new ServiceError('NOT_FOUND', 'Usuario no encontrado. Asegúrate de que el correo esté registrado en TaskZen.')
  }
  const inserted = await db
    .insert(teamMembers)
    .values({ team_id: teamId, user_id: target.id, role })
    .onConflictDoNothing()
    .returning({ id: teamMembers.id })
  if (inserted.length === 0) throw new ServiceError('CONFLICT', 'El usuario ya es miembro de este equipo.')
}

async function adminCount(db: Db, teamId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, 'admin')))
  return row.n
}

export async function removeMember(db: Db, userId: string, teamId: string, targetId: string) {
  // Cualquiera puede abandonar un equipo; para expulsar a otro hay que ser admin.
  if (targetId !== userId) await requireAdmin(db, userId, teamId)
  else await requireRole(db, userId, teamId)

  const target = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, targetId)))
    .limit(1)
  if (target.length === 0) throw new ServiceError('NOT_FOUND', 'El usuario no es miembro del equipo.')
  if (target[0].role === 'admin' && (await adminCount(db, teamId)) <= 1) {
    throw new ServiceError('CONFLICT', 'El equipo necesita al menos un administrador.')
  }
  await db.delete(teamMembers).where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, targetId)))
}

export async function updateMemberRole(db: Db, userId: string, teamId: string, targetId: string, role: TeamRole) {
  await requireAdmin(db, userId, teamId)
  const [target] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, targetId)))
    .limit(1)
  if (!target) throw new ServiceError('NOT_FOUND', 'El usuario no es miembro del equipo.')
  if (target.role === 'admin' && role !== 'admin' && (await adminCount(db, teamId)) <= 1) {
    throw new ServiceError('CONFLICT', 'El equipo necesita al menos un administrador.')
  }
  await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, targetId)))
}

export async function deleteTeam(db: Db, userId: string, teamId: string) {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'team:delete')) throw new ServiceError('FORBIDDEN', 'Solo un administrador puede borrar el equipo.')
  const [team] = await db.select({ is_personal: teams.is_personal }).from(teams).where(eq(teams.id, teamId))
  if (team?.is_personal) throw new ServiceError('CONFLICT', 'No puedes borrar tu espacio personal.')
  await db.delete(teams).where(eq(teams.id, teamId))
}
