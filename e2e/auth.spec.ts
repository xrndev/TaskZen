import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { logOut, seedUser, signIn, type TestUser } from './helpers'

const run = Date.now().toString(36)
const erin: TestUser = { name: 'Erin E2E', email: `erin-${run}@e2e.dev`, password: 'e2e-password-5' }

let page: Page
let cdp: CDPSession
test.describe.configure({ mode: 'serial' })
test.beforeAll(async ({ browser }) => {
  await seedUser(erin)
  const context = await browser.newContext()
  page = await context.newPage()
  // Autenticador virtual: simula la huella/PIN del dispositivo para probar passkeys sin hardware.
  cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
})
test.afterAll(async () => {
  await page.close()
})

const openProfile = async () => {
  await page.locator('img[alt="Avatar"]:visible').click()
  await expect(page.getByRole('heading', { name: 'Cambiar contraseña' })).toBeVisible()
}

test('la pantalla de acceso carga sin errores (hidratación incluida)', async ({ browser }) => {
  const p = await browser.newPage()
  const errors: string[] = []
  p.on('pageerror', (e) => errors.push(e.message))
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await p.goto('/login')
  await expect(p.getByRole('button', { name: 'Entrar con passkey' })).toBeVisible()
  await p.waitForTimeout(1000)
  expect(errors).toEqual([])
  await p.close()
})

test('añadir un passkey desde el perfil y entrar con él', async () => {
  await signIn(page, erin)
  await openProfile()
  await page.getByRole('button', { name: /Añadir un passkey/ }).click()
  await expect(page.getByText(/Passkey añadido/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Eliminar passkey' })).toHaveCount(1)

  await logOut(page)
  await page.getByRole('button', { name: 'Entrar con passkey' }).click()
  await page.waitForURL('**/board')
  await expect(page.locator('img[alt="Avatar"]:visible')).toBeVisible()
})

test('cambiar la contraseña: la antigua deja de valer', async () => {
  await openProfile()
  await page.locator('#sec-current').fill(erin.password)
  await page.locator('#sec-next').fill('nueva-clave-e2e-1')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await expect(page.getByText(/Contraseña cambiada/)).toBeVisible()

  await logOut(page)
  await page.getByLabel('Email').fill(erin.email)
  await page.getByLabel('Contraseña').fill(erin.password)
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await expect(page.locator('div.text-error[role="alert"]')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('Contraseña').fill('nueva-clave-e2e-1')
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
  await page.waitForURL('**/board')
})

test('el passkey se puede eliminar', async () => {
  await openProfile()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Eliminar passkey' }).click()
  await expect(page.getByRole('button', { name: 'Eliminar passkey' })).toHaveCount(0)
})
