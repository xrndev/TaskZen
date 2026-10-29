'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/billing'
import { run } from './run'

export async function getMyBillingAction() {
  return run((u) => uc.getMyBilling(db, u))
}
export async function getTeamBillingAction(teamId: string) {
  return run((u) => uc.getTeamBilling(db, u, teamId))
}
export async function startUserTrialAction(plan: string) {
  return run((u) => uc.startUserTrial(db, u, { plan }))
}
export async function startTeamTrialAction(teamId: string, plan: string) {
  return run((u) => uc.startTeamTrial(db, u, teamId, { plan }))
}
export async function exportTeamAction(teamId: string, format: string) {
  return run((u) => uc.exportTeam(db, u, teamId, format))
}
export async function exportMineAction(format: string) {
  return run((u) => uc.exportMine(db, u, format))
}
