import { expect, test, type Page } from '@playwright/test'
import { logOut, seedUser, signIn, type TestUser, visibleText } from './helpers'

const run = Date.now().toString(36)
const carol: TestUser = { name: 'Carol E2E', email: `carol-${run}@e2e.dev`, password: 'e2e-password-3' }
const dave: TestUser = { name: 'Dave E2E', email: `dave-${run}@e2e.dev`, password: 'e2e-password-4' }
const TEAM = `Equipo ${run}`

let page: Page
test.describe.configure({ mode: 'serial' })
test.beforeAll(async ({ browser }) => {
  await seedUser(carol)
  page = await browser.newPage()
})
test.afterAll(async () => {
  await page.close()
})

// El atajo no existe hasta que la página se hidrata: se reintenta hasta que abre el modal.
const openNewTaskWithShortcut = () =>
  expect(async () => {
    await page.keyboard.press('n')
    await expect(page.getByRole('heading', { name: 'Crear Nueva Tarea' })).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })

const teamSelect = () => page.locator('select:visible').first()

test('atajos, vistas de lista y calendario', async () => {
  await signIn(page, carol)

  // Atajo N abre "nueva tarea"; el atajo se ignora al escribir en un campo.
  await openNewTaskWithShortcut()
  await page.getByPlaceholder(/Rediseñar/).fill('nnn')
  await expect(page.getByPlaceholder(/Rediseñar/)).toHaveValue('nnn')
  await page.getByPlaceholder(/Rediseñar/).fill('Tarea de vistas')
  await page.getByRole('button', { name: 'Añadir al Tablero' }).click()
  await expect(visibleText(page, 'Tarea de vistas')).toBeVisible()

  await page.keyboard.press('2')
  await expect(page.getByRole('button', { name: 'Fecha límite' })).toBeVisible()
  await expect(visibleText(page, 'Tarea de vistas')).toBeVisible()

  await page.keyboard.press('3')
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeVisible()
  await expect(visibleText(page, /Sin fecha límite \(1\)/)).toBeVisible()

  await page.keyboard.press('1')
  await expect(page.getByRole('heading', { name: 'Pendiente' })).toBeVisible()
})

test('invitación por enlace: la única vía para crear una cuenta nueva', async () => {
  await teamSelect().selectOption('NEW_TEAM')
  await page.getByPlaceholder(/Proyecto Alpha/).fill(TEAM)
  await page.getByRole('button', { name: 'Crear Equipo' }).click()
  await expect(page.locator('option', { hasText: TEAM }).first()).toBeAttached()

  await openNewTaskWithShortcut()
  await page.getByPlaceholder(/Rediseñar/).fill('Tarea del equipo')
  await page.getByRole('button', { name: 'Añadir al Tablero' }).click()
  await expect(visibleText(page, 'Tarea del equipo')).toBeVisible()

  await page.getByTitle('Gestionar Miembros').click()
  await page.getByRole('button', { name: /Generar y copiar enlace/ }).click()
  const link = await page.locator('input[readonly]').inputValue()
  expect(link).toMatch(/\/invite\/[\w-]{20,}$/)
  await page.getByRole('button', { name: 'Revocar' }).waitFor()

  await logOut(page)

  // Sin invitación, crear la cuenta se rechaza.
  await page.goto('/login')
  await page.getByRole('button', { name: 'Tengo una invitación' }).click()
  await page.getByLabel('Nombre Completo').fill('Intruso')
  await page.getByLabel('Email').fill(`intruso-${run}@e2e.dev`)
  await page.getByLabel('Contraseña').fill('e2e-password-9')
  await page.getByRole('button', { name: 'Crear Cuenta' }).click()
  await expect(page.locator('div.text-error[role="alert"]')).toContainText(/solo por invitación/i)
  await expect(page).toHaveURL(/\/login/)

  // Con el enlace, Dave puede registrarse y entra al equipo como miembro.
  await page.goto(new URL(link).pathname)
  await expect(page.getByRole('heading', { name: new RegExp(`invitado a ${TEAM}`) })).toBeVisible()
  await page.getByRole('button', { name: 'Crear cuenta o iniciar sesión' }).click()
  await page.waitForURL(/\/login\?next=/)
  await page.getByLabel('Nombre Completo').fill(dave.name)
  await page.getByLabel('Email').fill(dave.email)
  await page.getByLabel('Contraseña').fill(dave.password)
  await page.getByRole('button', { name: 'Crear Cuenta' }).click()
  await page.waitForURL('**/invite/**')

  await page.getByRole('button', { name: 'Unirme al equipo' }).click()
  await page.waitForURL(/\/board\?team=/)
  await expect(visibleText(page, 'Tarea del equipo')).toBeVisible()
  await expect(page.getByTitle('Gestionar Miembros')).toHaveCount(0)
})

test('?next= no permite redirecciones externas y un token inventado se rechaza', async () => {
  await page.goto('/login?next=//evil.example')
  await expect(page).toHaveURL(/\/board$/)
  await page.goto('/login?next=https://evil.example')
  await expect(page).toHaveURL(/\/board$/)

  await page.goto('/invite/token-que-no-existe-0123456789')
  await expect(page.getByRole('heading', { name: 'Invitación no válida' })).toBeVisible()
})

test('la cookie de invitación falsa no abre el registro', async ({ request }) => {
  const res = await request.post('/api/auth/sign-up/email', {
    headers: { Origin: new URL(page.url()).origin, Cookie: 'tz_invite=token-falso-0123456789abcdef' },
    data: { email: `falso-${run}@e2e.dev`, password: 'e2e-password-8', name: 'Falso' },
  })
  expect(res.status()).toBe(403)
  expect((await request.post('/api/invite/claim', { data: { token: 'inventado-1234567890' } })).status()).toBe(404)
})
