import { expect, test, type Page } from '@playwright/test'
import { dbRows, seedUser, signIn, type TestUser } from './helpers'

const run = Date.now().toString(36)
const erin: TestUser = { name: 'Erin E2E', email: `erin-${run}@e2e.dev`, password: 'e2e-password-5' }

test('la página de precios compara los planes y marca lo planificado como próximamente', async ({ page }) => {
  await page.goto('/precios')
  await expect(page.getByRole('heading', { name: 'Planes y precios', level: 1 })).toBeVisible()

  const equipos = page.getByRole('table', { name: 'Comparativa de planes de equipo' })
  await expect(equipos.getByRole('row', { name: /Miembros por equipo/ })).toContainText('5')
  await expect(equipos.getByRole('row', { name: /Miembros por equipo/ })).toContainText('Ilimitados')
  await expect(equipos.getByRole('row', { name: /Registro de auditoría/ })).toContainText('Próximamente')

  const personas = page.getByRole('table', { name: 'Comparativa de planes personales' })
  await expect(personas.getByRole('row', { name: /Exportar tus tareas a CSV/ })).toBeVisible()
  // Lo que aún no existe nunca figura como incluido.
  await expect(personas.getByRole('row', { name: /Sincronizar con tu calendario/ }).getByRole('img', { name: 'Incluido', exact: true })).toHaveCount(0)

  // La landing enlaza a los planes y no desborda en móvil.
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Ver planes' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/precios')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test.describe('plan dentro de la app', () => {
  test.describe.configure({ mode: 'serial' })
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedUser(erin)
    page = await browser.newPage()
  })
  test.afterAll(async () => {
    await page.close()
  })

  test('el perfil muestra el plan gratuito, deja probar Plus y desbloquea la exportación', async () => {
    await signIn(page, erin)
    await page.locator('img[alt="Avatar"]:visible').click()

    const panel = page.getByRole('region', { name: 'Tu plan' })
    await expect(panel.getByText('Personal Gratis')).toBeVisible()
    await expect(panel.getByText('Plan gratuito', { exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: /CSV/ })).toBeDisabled()

    await panel.getByRole('button', { name: 'Probar Personal Plus' }).click()
    await expect(panel.getByText(/Prueba gratuita · quedan 14 días/)).toBeVisible()
    await expect(panel.getByRole('button', { name: /CSV/ })).toBeEnabled()
    await expect(panel.getByRole('button', { name: 'Probar Personal Plus' })).toHaveCount(0) // la prueba es de una sola vez

    const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: /CSV/ }).click()])
    expect(download.suggestedFilename()).toMatch(/^serenboard-mis-tareas-\d{4}-\d{2}-\d{2}\.csv$/)

    const rows = await dbRows<{ plan: string; status: string }>(
      `select s.plan, s.status from subscriptions s join "user" u on u.id = s.user_id where u.email = $1`, [erin.email],
    )
    expect(rows).toEqual([{ plan: 'user_plus', status: 'trialing' }])
  })
})
