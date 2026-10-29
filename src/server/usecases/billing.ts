import { z } from 'zod'
import type { Db } from '@/server/db'
import * as billing from '@/server/services/billing'
import * as exp from '@/server/services/export'
import { parseId } from './common'

const userTrialSchema = z.object({ plan: z.enum(['user_plus', 'user_pro'], { error: 'Plan no válido.' }) })
const teamTrialSchema = z.object({ plan: z.enum(['team_plus', 'team_pro'], { error: 'Plan no válido.' }) })
const formatSchema = z.enum(['csv', 'json'], { error: 'Formato no válido: usa csv o json.' }).default('csv')

export const getMyBilling = (db: Db, userId: string) => billing.getMyBilling(db, userId)
export const getTeamBilling = (db: Db, userId: string, teamId: string) => billing.getTeamBilling(db, userId, parseId(teamId))

export const startUserTrial = (db: Db, userId: string, input: unknown) =>
  billing.startTrial(db, userId, { plan: userTrialSchema.parse(input).plan })
export const startTeamTrial = (db: Db, userId: string, teamId: string, input: unknown) =>
  billing.startTrial(db, userId, { teamId: parseId(teamId), plan: teamTrialSchema.parse(input).plan })

/** Devuelve el archivo como texto (nombre, tipo y contenido): el cliente lo guarda; así sirve igual a la web y a la app. */
export const exportTeam = (db: Db, userId: string, teamId: string, format: unknown) =>
  exp.exportTeam(db, userId, parseId(teamId), formatSchema.parse(format ?? undefined))
export const exportMine = (db: Db, userId: string, format: unknown) => exp.exportMine(db, userId, formatSchema.parse(format ?? undefined))
