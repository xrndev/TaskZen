import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { teamInvites, teamMembers, teams, user } from '@/db/schema'
import { can } from '@/lib/permissions'
import type { Db } from '@/server/db'
import type { TeamRole } from '@/types'
import { requireRole, roleIn, ServiceError } from './common'

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface InviteInfo {
  id: string
  role: TeamRole
  expires_at: string
  created_at: string
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

async function requireAdmin(db: Db, userId: string, teamId: string) {
  const role = await requireRole(db, userId, teamId)
  if (!can(userId, role, 'team:manage_members')) {
    throw new ServiceError('FORBIDDEN', 'Solo un administrador puede gestionar invitaciones.')
  }
}

/** Crea un enlace de invitación. El token en claro solo se devuelve aquí, nunca se vuelve a poder leer. */
export async function createInvite(db: Db, userId: string, teamId: string, role: TeamRole = 'member') {
  await requireAdmin(db, userId, teamId)
  // Un enlace público nunca concede administración: eso se hace a mano, con la persona ya dentro.
  if (role === 'admin') throw new ServiceError('INVALID', 'Los enlaces no pueden conceder el rol de administrador.')
  const [team] = await db.select({ is_personal: teams.is_personal }).from(teams).where(eq(teams.id, teamId))
  if (team?.is_personal) throw new ServiceError('INVALID', 'Tu espacio personal no admite invitaciones. Crea un equipo.')

  const token = randomBytes(24).toString('base64url')
  const expires = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  const [row] = await db
    .insert(teamInvites)
    .values({ team_id: teamId, token_hash: hash(token), role, created_by: userId, expires_at: expires })
    .returning({ id: teamInvites.id, role: teamInvites.role, expires_at: teamInvites.expires_at, created_at: teamInvites.created_at })
  return { token, invite: row as InviteInfo }
}

export async function listInvites(db: Db, userId: string, teamId: string): Promise<InviteInfo[]> {
  await requireAdmin(db, userId, teamId)
  return db
    .select({ id: teamInvites.id, role: teamInvites.role, expires_at: teamInvites.expires_at, created_at: teamInvites.created_at })
    .from(teamInvites)
    .where(and(eq(teamInvites.team_id, teamId), isNull(teamInvites.revoked_at), gt(teamInvites.expires_at, new Date().toISOString())))
    .orderBy(desc(teamInvites.created_at))
}

export async function revokeInvite(db: Db, userId: string, inviteId: string) {
  const [inv] = await db.select({ team_id: teamInvites.team_id }).from(teamInvites).where(eq(teamInvites.id, inviteId))
  if (!inv) throw new ServiceError('NOT_FOUND', 'Invitación no encontrada.')
  await requireAdmin(db, userId, inv.team_id)
  await db.update(teamInvites).set({ revoked_at: new Date().toISOString() }).where(eq(teamInvites.id, inviteId))
}

async function findValid(db: Db, token: string) {
  const [inv] = await db
    .select({ team_id: teamInvites.team_id, role: teamInvites.role, created_by: teamInvites.created_by })
    .from(teamInvites)
    .where(and(eq(teamInvites.token_hash, hash(token)), isNull(teamInvites.revoked_at), gt(teamInvites.expires_at, new Date().toISOString())))
  if (!inv) throw new ServiceError('NOT_FOUND', 'Este enlace de invitación no es válido o ha caducado.')
  return inv
}

/** Datos mínimos para mostrar en la página de invitación (no requiere sesión). */
export async function previewInvite(db: Db, token: string) {
  const inv = await findValid(db, token)
  const [row] = await db
    .select({ team: teams.name, inviter: user.name })
    .from(teams)
    .innerJoin(user, eq(user.id, inv.created_by))
    .where(eq(teams.id, inv.team_id))
  return { team_name: row.team, inviter_name: row.inviter, role: inv.role }
}

/** Añade al usuario al equipo. Es idempotente: si ya es miembro, no cambia su rol. */
export async function acceptInvite(db: Db, userId: string, token: string): Promise<{ team_id: string }> {
  const inv = await findValid(db, token)
  if (!(await roleIn(db, userId, inv.team_id))) {
    await db.insert(teamMembers).values({ team_id: inv.team_id, user_id: userId, role: inv.role }).onConflictDoNothing()
  }
  return { team_id: inv.team_id }
}

/** Comprobación sin lanzar errores, para el control de registro. */
export async function isInviteValid(db: Db, token: string): Promise<boolean> {
  try {
    await findValid(db, token)
    return true
  } catch (e) {
    if (e instanceof ServiceError) return false
    throw e
  }
}
