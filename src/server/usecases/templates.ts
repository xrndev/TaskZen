import { z } from 'zod'
import type { Db } from '@/server/db'
import * as svc from '@/server/services/templates'
import { TEMPLATE_IDS } from '@/lib/templates'
import { parseId } from './common'

const applySchema = z.object({ template: z.enum(TEMPLATE_IDS, 'Plantilla no válida.'), lang: z.enum(['es', 'en']).optional() })

export async function applyTemplate(db: Db, userId: string, teamId: string, input: unknown) {
  const { template, lang } = applySchema.parse(input)
  return svc.applyTemplate(db, userId, parseId(teamId), template, new Date(), lang)
}
