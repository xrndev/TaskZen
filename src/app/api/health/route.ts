import { sql } from 'drizzle-orm'
import { db } from '@/server/db'

export const dynamic = 'force-dynamic'

/** Comprobación de salud para vigilancia externa: responde 200 solo si la base de datos contesta. No expone datos. */
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
