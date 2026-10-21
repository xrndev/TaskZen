import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import path from 'node:path'
import * as schema from '@/db/schema'
import type { Db } from '@/server/db'
import { ensurePersonalTeam } from '@/server/services/teams'

/** Base de datos Postgres en memoria con las migraciones reales aplicadas. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') })
  return db as unknown as Db
}

export async function createUser(db: Db, name: string) {
  const id = `u_${name}`
  await db.insert(schema.user).values({ id, name, email: `${name.toLowerCase()}@test.dev` })
  const team = await ensurePersonalTeam(db, id, name)
  return { id, name, team }
}
