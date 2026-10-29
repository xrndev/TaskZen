'use server'

import { db } from '@/server/db'
import * as uc from '@/server/usecases/templates'
import { run } from './run'

export async function applyTemplateAction(teamId: string, input: { template: string; lang?: string }) {
  return run((u) => uc.applyTemplate(db, u, teamId, input))
}
