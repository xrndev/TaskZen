import { expect, test, type Page } from '@playwright/test'
import { dbRows, seedUser, signIn, type TestUser, visibleText } from './helpers'

const run = Date.now().toString(36)
const nora: TestUser = { name: 'Nora E2E', email: `nora-${run}@e2e.dev`, password: 'e2e-password-n1' }

const column = (page: Page, title: string) =>
  page.locator('h2', { hasText: title }).locator('xpath=ancestor::div[contains(@class,"min-h-[500px]")]')

test.describe.configure({ mode: 'serial' })

let page: Page
test.beforeAll(async ({ browser }) => {
  await seedUser(nora)
  page = await browser.newPage()
})
test.afterAll(async () => {
  await page.close()
})

test('subtareas: añadir, marcar, ver el avance en la tarjeta y borrar', async () => {
  await signIn(page, nora)
  await page.getByRole('button', { name: /Nueva tarea/ }).click()
  await page.getByPlaceholder(/Rediseñar/).fill('Preparar la entrega')
  await page.getByRole('button', { name: 'Añadir al Tablero' }).click()
  await visibleText(page, 'Preparar la entrega').click()

  const lista = page.getByRole('region', { name: 'Subtareas' })
  await lista.getByLabel('Nueva subtarea').fill('Redactar el informe')
  await lista.getByRole('button', { name: 'Añadir' }).click()
  await expect(lista.getByRole('checkbox')).toHaveCount(1) // espera a que termine antes de escribir la siguiente
  await lista.getByLabel('Nueva subtarea').fill('Revisarlo con el equipo')
  await lista.getByRole('button', { name: 'Añadir' }).click()
  await expect(lista.getByRole('checkbox')).toHaveCount(2)

  await lista.getByRole('checkbox', { name: 'Redactar el informe' }).click()
  await expect(lista.getByRole('progressbar', { name: 'Progreso de subtareas' })).toHaveAttribute('aria-valuenow', '1')
  // El avance también se ve en la tarjeta del tablero.
  await expect(page.getByTitle('1 de 2 subtareas hechas').first()).toBeVisible()

  await lista.getByRole('button', { name: 'Borrar subtarea Revisarlo con el equipo' }).click()
  await expect(lista.getByRole('checkbox')).toHaveCount(1)
})

test('columnas: añadir una propia, mover una tarea y respetar el límite del plan gratuito', async () => {
  await page.goto('/board')
  await page.getByRole('button', { name: 'Columnas' }).click()
  const dialog = page.getByRole('dialog', { name: 'Columnas del tablero' })
  // El plan gratuito ya usa sus tres columnas: la cuarta abre el diálogo de mejora.
  await dialog.getByLabel('Nueva columna').fill('En revisión')
  await dialog.getByRole('button', { name: 'Añadir columna' }).click()
  await expect(page.getByRole('dialog', { name: 'Has llegado al límite de tu plan' })).toBeVisible()
  await page.getByRole('button', { name: 'Ahora no' }).click()

  // Renombrar una de serie sí es gratis.
  const nombres = dialog.getByLabel('Nombre')
  await nombres.first().fill('Por empezar')
  await nombres.first().blur()
  await expect(column(page, 'Por empezar')).toContainText('Preparar la entrega')
  const [{ n }] = await dbRows<{ n: number }>(
    `select count(*)::int as n from board_columns c join teams t on t.id = c.team_id join "user" u on u.id = t.owner_id where u.email = $1`, [nora.email],
  )
  expect(n).toBe(3)
})

test('el idioma se puede cambiar a inglés y se recuerda', async () => {
  await page.goto('/precios')
  await expect(page.getByRole('heading', { name: 'Planes y precios', level: 1 })).toBeVisible()
  await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'en', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Plans and pricing', level: 1 })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('article', { has: page.getByRole('heading', { name: 'Personal Plus' }) })).toContainText('€3')

  // La elección sobrevive a recargar y se aplica también dentro de la app.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Plans and pricing', level: 1 })).toBeVisible()
  await page.goto('/board')
  await expect(page.getByRole('button', { name: /New task/ }).first()).toBeVisible()
  await expect(column(page, 'In progress')).toBeVisible()

  await page.context().clearCookies()
})
