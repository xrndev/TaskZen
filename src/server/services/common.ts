import { and, eq, sql } from 'drizzle-orm'
import { teamMembers, user } from '@/db/schema'
import type { Db } from '@/server/db'
import type { Profile, TeamRole } from '@/types'

export type ErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID' | 'CONFLICT'

/** Error de negocio con mensaje apto para mostrar al usuario. */
export class ServiceError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
  }
}

export async function roleIn(db: Db, userId: string, teamId: string): Promise<TeamRole | null> {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, userId)))
    .limit(1)
  return row?.role ?? null
}

/** Devuelve el rol o lanza FORBIDDEN. No distingue "no existe" de "no eres miembro". */
export async function requireRole(db: Db, userId: string, teamId: string): Promise<TeamRole> {
  const role = await roleIn(db, userId, teamId)
  if (!role) throw new ServiceError('FORBIDDEN', 'No tienes acceso a este equipo.')
  return role
}

export function toProfile(u: typeof user.$inferSelect): Profile {
  return { id: u.id, email: u.email, full_name: u.name, avatar_url: u.image, created_at: u.createdAt.toISOString() }
}

export const profileColumns = {
  id: user.id,
  email: user.email,
  full_name: user.name,
  avatar_url: user.image,
  created_at: sql<string>`${user.createdAt}::text`,
}

/** Avisa a los clientes conectados por SSE de que el tablero de un equipo cambió. */
export async function notifyTeam(db: Db, teamId: string) {
  await db.execute(sql`select pg_notify('team_events', ${teamId})`)
}
