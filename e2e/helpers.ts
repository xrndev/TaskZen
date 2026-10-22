import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import pg from 'pg'
import { expect, type Page } from '@playwright/test'

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://taskzen:devpass@localhost:5433/taskzen'

export interface TestUser { name: string; email: string; password: string }

/**
 * El registro está cerrado (como en producción), así que las cuentas de partida se crean directamente
 * en la base de datos, con el mismo hash de contraseña que usa Better Auth y su espacio personal.
 */
export async function seedUser(u: TestUser) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const id = `e2e_${randomUUID()}`
    await client.query('insert into "user"(id, name, email, email_verified) values ($1, $2, $3, false)', [id, u.name, u.email])
    await client.query(
      `insert into account(id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)`,
      [randomUUID(), id, await hashPassword(u.password)],
    )
    const { rows } = await client.query(`insert into teams(name, owner_id, is_personal) values ($1, $2, true) returning id`, [`Personal · ${u.name}`, id])
    await client.query(`insert into team_members(team_id, user_id, role) values ($1, $2, 'admin')`, [rows[0].id, id])
    return id
  } finally {
    await client.end()
  }
}

export async function signIn(page: Page, u: TestUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(u.email)
  await page.getByLabel('Contraseña').fill(u.password)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await page.waitForURL('**/board')
}

export async function logOut(page: Page) {
  await page.goto('/board')
  await page.locator('img[alt="Avatar"]:visible').click()
  await page.getByRole('button', { name: /Cerrar tu sesión/ }).click()
  await page.waitForURL('**/login')
}

/** Consulta de solo lectura a la base de datos de pruebas. */
export async function dbRows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    return (await client.query(sql, params)).rows as T[]
  } finally {
    await client.end()
  }
}

export async function attachmentId(fileName: string) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query('select id from attachments where file_name = $1 order by created_at desc limit 1', [fileName])
    return rows[0].id as string
  } finally {
    await client.end()
  }
}

/** Texto visible: el tablero de escritorio y el de móvil conviven en el DOM y uno de ellos está oculto con CSS. */
export const visibleText = (page: Page, text: string | RegExp) => page.getByText(text).and(page.locator(':visible'))

export { expect }
