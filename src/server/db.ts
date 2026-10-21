import { drizzle } from 'drizzle-orm/node-postgres'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { Pool } from 'pg'
import * as schema from '@/db/schema'

/** Tipo común al driver de producción (pg) y al de tests (PGlite). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const g = globalThis as unknown as { __pool?: Pool }

// El Pool no abre conexiones hasta la primera consulta, así que `next build` no necesita base de datos.
export const pool = g.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
if (process.env.NODE_ENV !== 'production') g.__pool = pool

export const db: Db = drizzle(pool, { schema })
