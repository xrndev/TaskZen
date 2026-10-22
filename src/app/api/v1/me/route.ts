import { eq } from 'drizzle-orm'
import { user } from '@/db/schema'
import { db } from '@/server/db'
import { api } from '@/server/api/http'
import { ServiceError, toProfile } from '@/server/services/common'

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  return api(req, async (u) => {
    const [row] = await db.select().from(user).where(eq(user.id, u))
    if (!row) throw new ServiceError('NOT_FOUND', 'No encontrado.')
    return toProfile(row)
  })
}
