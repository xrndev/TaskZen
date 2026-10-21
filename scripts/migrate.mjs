// Aplica las migraciones de ./drizzle. JavaScript plano para poder ejecutarlo dentro de la imagen de producción.
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL no está definida.')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url, max: 1 })
try {
  await migrate(drizzle(pool), { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  console.log('Migraciones aplicadas.')
} finally {
  await pool.end()
}
