import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { dbRows, seedUser, signIn, type TestUser } from './helpers'

const run = Date.now().toString(36)
const erin: TestUser = { name: 'Erin E2E', email: `erin-${run}@e2e.dev`, password: 'e2e-password-5' }
const gina: TestUser = { name: 'Gina E2E', email: `gina-${run}@e2e.dev`, password: 'e2e-password-7' }
const hugo: TestUser = { name: 'Hugo E2E', email: `hugo-${run}@e2e.dev`, password: 'e2e-password-8' }

test('la página de precios compara los planes y marca lo planificado como próximamente', async ({ page }) => {
  await page.goto('/precios')
  await expect(page.getByRole('heading', { name: 'Planes y precios', level: 1 })).toBeVisible()

  const equipos = page.getByRole('table', { name: 'Comparativa de planes de equipo' })
  await expect(equipos.getByRole('row', { name: /Miembros por equipo/ })).toContainText('5')
  await expect(equipos.getByRole('row', { name: /Miembros por equipo/ })).toContainText('Ilimitados')
  await expect(equipos.getByRole('row', { name: /Registro de auditoría/ })).toContainText('Próximamente')
  await expect(equipos.getByRole('row', { name: /Tamaño máximo por archivo/ })).toContainText('50 MB')

  const personas = page.getByRole('table', { name: 'Comparativa de planes personales' })
  await expect(personas.getByRole('row', { name: /Exportar tus tareas a CSV/ })).toBeVisible()
  // Lo que aún no existe nunca figura como incluido.
  await expect(personas.getByRole('row', { name: /Notas privadas/ }).getByRole('img', { name: 'Incluido', exact: true })).toHaveCount(0)

  // Personal Pro no se anuncia (ni tarjeta ni columna), y las tarjetas de pago no prometen funciones futuras.
  await expect(page.getByText('Personal Pro')).toHaveCount(0)
  await expect(page.locator('article').getByText('Próximamente')).toHaveCount(0)

  // La landing enlaza a los planes y no desborda en móvil.
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Ver planes' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/precios')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('el interruptor mensual/anual cambia los precios de las tarjetas', async ({ page }) => {
  await page.goto('/precios')
  const plus = page.locator('article', { has: page.getByRole('heading', { name: 'Personal Plus' }) })
  await expect(plus).toContainText('3 €')
  await expect(plus).toContainText('/ mes')
  await page.getByRole('radio', { name: /Anual/ }).click()
  await expect(plus).toContainText('30 €')
  await expect(plus).toContainText('/ año')
  await expect(plus).toContainText('equivale a 2,50 € al mes')
  await page.getByRole('radio', { name: 'Mensual' }).click()
  await expect(plus).toContainText('/ mes')
})

test('la administración de planes no existe para quien no es administrador', async ({ page }) => {
  expect((await page.goto('/admin/planes'))?.status()).toBe(404) // sin sesión
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
    // Solo se ofrece probar los planes anunciados.
    await expect(panel.getByRole('button', { name: 'Probar Personal Pro' })).toHaveCount(0)

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

  test('al alcanzar un límite se ofrece mejorar el plan en ese momento', async ({ browser }) => {
    // Gina es gratuita y ya tiene su equipo propio: crear otro choca con el límite.
    const id = await seedUser(gina)
    const [team] = await dbRows<{ id: string }>(`insert into teams(name, owner_id) values ('Equipo de Gina', $1) returning id`, [id])
    await dbRows(`insert into team_members(team_id, user_id, role) values ($1, $2, 'admin')`, [team.id, id])

    const p = await browser.newPage()
    await signIn(p, gina)
    await p.getByRole('combobox').first().selectOption({ label: '+ Nuevo Equipo' })
    await p.getByPlaceholder(/Proyecto Alpha/).fill('Un segundo equipo')
    await p.getByRole('button', { name: 'Crear Equipo' }).click()

    const dialog = p.getByRole('dialog', { name: 'Has llegado al límite de tu plan' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('equipo propio')
    await expect(dialog).toContainText('14 días gratis')
    // El botón lleva directo al plan (el de la persona, porque el límite es suyo).
    await dialog.getByRole('button', { name: 'Ver mi plan' }).click()
    await expect(p.getByRole('region', { name: 'Tu plan' })).toBeVisible()
    await p.close()
  })

  test('una prueba a punto de terminar avisa dentro de la app, y el aviso se puede cerrar', async ({ browser }) => {
    const id = await seedUser(hugo)
    await dbRows(
      `insert into subscriptions(id, user_id, plan, status, ends_at, provider) values ($1, $2, 'user_plus', 'trialing', now() + interval '2 days', 'trial')`,
      [randomUUID(), id],
    )
    const p = await browser.newPage()
    await signIn(p, hugo)
    const banner = p.getByRole('status').filter({ hasText: 'Tu prueba de Personal Plus termina en' })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('volverás al plan gratuito')
    await expect(banner).toContainText('no se borra nada')

    await banner.getByRole('button', { name: 'Cerrar aviso' }).click()
    await expect(banner).toHaveCount(0)
    await p.reload()
    await expect(p.getByRole('status').filter({ hasText: 'Tu prueba de Personal Plus termina en' })).toHaveCount(0) // recuerda que se cerró
    await p.close()
  })
})
