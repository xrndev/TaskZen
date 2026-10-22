import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { dbRows, seedUser, signIn, type TestUser } from './helpers'

const E2E_TICK_SECRET = process.env.E2E_TICK_SECRET!
const run = Date.now().toString(36)
const gina: TestUser = { name: 'Gina E2E', email: `gina-${run}@e2e.dev`, password: 'e2e-password-7' }
const FAKE_ENDPOINT = `https://fcm.googleapis.com/fcm/send/e2e-${run}`

test.describe('endpoint interno de recordatorios', () => {
  const tick = '/api/internal/reminders/tick'

  test('rechaza llamadas sin clave, con clave incorrecta o con otro método', async ({ request }) => {
    const cases: Record<string, string>[] = [{}, { Authorization: 'Bearer incorrecta' }, { Authorization: E2E_TICK_SECRET }, { Authorization: 'Basic abc' }]
    for (const headers of cases) {
      const res = await request.post(tick, { headers })
      expect(res.status(), JSON.stringify(headers)).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    expect((await request.get(tick)).status()).toBe(405)
  })

  test('con la clave correcta devuelve solo contadores, sin datos de tareas ni de personas', async ({ request }) => {
    const res = await request.post(tick, { headers: { Authorization: `Bearer ${E2E_TICK_SECRET}` } })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(['disabledEndpoints', 'planned', 'retried', 'sent', 'skipped'])
    for (const v of Object.values(body)) expect(typeof v).toBe('number')
  })

  test('/api/health responde sin exponer datos', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test('/sw.js se sirve como JavaScript y sin caché', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('javascript')
    expect(res.headers()['cache-control']).toContain('no-cache')
    const body = await res.text()
    expect(body).toContain("addEventListener('push'")
    expect(body).toContain("addEventListener('notificationclick'")
  })
})

test.describe('ajustes de notificaciones', () => {
  let userId: string
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    userId = await seedUser(gina)
  })

  /** Chromium sin servicio de push real: se simula la suscripción y se concede el permiso. */
  async function prepare(page: Page, { alreadySubscribed = false } = {}) {
    await page.addInitScript(({ endpoint, preload }) => {
      // El Chromium sin interfaz devuelve "denied" aunque se conceda el permiso: se simula como concedido.
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' })
      Notification.requestPermission = async () => 'granted'
      let current: unknown = null
      const make = () => ({
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: 'BE2E'.padEnd(87, 'p'), auth: 'a'.repeat(22) } }),
        unsubscribe: async () => { current = null; return true },
      })
      if (preload) current = make() // un navegador real recuerda la suscripción entre visitas
      PushManager.prototype.subscribe = async () => (current = make()) as unknown as PushSubscription
      PushManager.prototype.getSubscription = async () => current as PushSubscription | null
    }, { endpoint: FAKE_ENDPOINT, preload: alreadySubscribed })
  }

  /** Un dispositivo ya suscrito tiene registrado el service worker: se reproduce ese estado. */
  const registerWorker = async (page: Page) => {
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
    })
  }

  const openProfile = async (page: Page) => {
    await page.locator('img[alt="Avatar"]:visible, button[aria-label="Mi perfil"]:visible').first().click()
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible()
  }

  test('activar este dispositivo, elegir avisos y que se conserven al recargar', async ({ page }) => {
    await prepare(page)
    await signIn(page, gina)
    await openProfile(page)

    // Antes de activar no hay opciones de aviso.
    await expect(page.getByRole('button', { name: 'Activar avisos en este dispositivo' })).toBeVisible()
    await expect(page.getByText('Cuando una tarea mía esté por vencer')).toHaveCount(0)

    await page.getByRole('button', { name: 'Activar avisos en este dispositivo' }).click()
    await expect(page.getByText('1 dispositivo recibe avisos.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desactivar en este dispositivo' })).toBeVisible()

    const [endpointRow] = await dbRows<{ endpoint: string; disabled_at: string | null }>('select endpoint, disabled_at from notification_endpoints where user_id = $1', [userId])
    expect(endpointRow).toMatchObject({ endpoint: FAKE_ENDPOINT, disabled_at: null })
    const [prefsRow] = await dbRows<{ enabled: boolean }>('select enabled from notification_prefs where user_id = $1', [userId])
    expect(prefsRow.enabled).toBe(true)

    // Valores por defecto: 1 día y 1 hora. Se añade 3 horas y se quita 1 día; se fija el silencio.
    await expect(page.getByRole('button', { name: '1 día' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '3 horas' }).click()
    await page.getByRole('button', { name: '1 día' }).click()
    await page.getByLabel('Desde').fill('22:00')
    await page.getByLabel('Hasta').fill('08:00')
    await page.getByLabel('Cuando me asignen una tarea').uncheck()
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Preferencias guardadas.')).toBeVisible()

    const [saved] = await dbRows<{ offsets_minutes: number[]; quiet_start: string; quiet_end: string; assigned: boolean }>('select offsets_minutes, quiet_start, quiet_end, assigned from notification_prefs where user_id = $1', [userId])
    expect(saved.offsets_minutes).toEqual([180, 60])
    expect(saved).toMatchObject({ quiet_start: '22:00', quiet_end: '08:00', assigned: false })

    await page.reload()
    await openProfile(page)
    await expect(page.getByRole('button', { name: '3 horas' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: '1 día' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByLabel('Desde')).toHaveValue('22:00')
    await expect(page.getByLabel('Cuando me asignen una tarea')).not.toBeChecked()
  })

  test('la sección es accesible en escritorio y en móvil', async ({ browser }) => {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600, isMobile: viewport.width < 600 })
      const page = await ctx.newPage()
      await prepare(page, { alreadySubscribed: true })
      await signIn(page, gina)
      await openProfile(page)
      await expect(page.getByText('1 dispositivo recibe avisos.')).toBeVisible()
      const axe = await new AxeBuilder({ page }).include('#notif-title').include('section[aria-labelledby="notif-title"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`), `axe a ${viewport.width}px`).toEqual([])
      await ctx.close()
    }
  })

  test('desactivar el último dispositivo lo borra y apaga las notificaciones', async ({ page }) => {
    await prepare(page, { alreadySubscribed: true })
    await signIn(page, gina)
    await registerWorker(page)
    await openProfile(page)
    await page.getByRole('button', { name: 'Desactivar en este dispositivo' }).click()
    await expect(page.getByRole('button', { name: 'Activar avisos en este dispositivo' })).toBeVisible()
    expect(await dbRows('select 1 from notification_endpoints where user_id = $1', [userId])).toHaveLength(0)
    const [prefsRow] = await dbRows<{ enabled: boolean }>('select enabled from notification_prefs where user_id = $1', [userId])
    expect(prefsRow.enabled).toBe(false)
  })
})

test.describe('enlace de un aviso: /board?task=<id>', () => {
  const hank: TestUser = { name: 'Hank E2E', email: `hank-${run}@e2e.dev`, password: 'e2e-password-8' }
  const ivy: TestUser = { name: 'Ivy E2E', email: `ivy-${run}@e2e.dev`, password: 'e2e-password-9' }

  test('abre la tarea indicada si eres miembro de su equipo, y no abre la de otro equipo', async ({ page }) => {
    const hankId = await seedUser(hank)
    const ivyId = await seedUser(ivy)
    const [team] = await dbRows<{ team_id: string }>('select team_id from team_members where user_id = $1', [hankId])
    const [other] = await dbRows<{ team_id: string }>('select team_id from team_members where user_id = $1', [ivyId])
    const [mine] = await dbRows<{ id: string }>(`insert into tasks(team_id, user_id, title, status, position) values ($1, $2, 'Tarea del aviso', 'pending', 1) returning id`, [team.team_id, hankId])
    const [foreign] = await dbRows<{ id: string }>(`insert into tasks(team_id, user_id, title, status, position) values ($1, $2, 'Tarea ajena', 'pending', 1) returning id`, [other.team_id, ivyId])

    await signIn(page, hank)
    await page.goto(`/board?task=${mine.id}`)
    await expect(page.getByText('Descripción larga')).toBeVisible()
    await expect(page.getByText('Tarea del aviso').and(page.locator(':visible')).first()).toBeVisible()

    // Tarea de otro equipo, identificador inexistente o basura: la página carga y no abre ningún panel.
    for (const bad of [foreign.id, '00000000-0000-4000-8000-000000000000', 'no-es-un-id']) {
      await page.goto(`/board?task=${bad}`)
      await expect(page.getByRole('button', { name: /New Task/ })).toBeVisible()
      await expect(page.getByText('Descripción larga')).toHaveCount(0)
      await expect(page.getByText('Tarea ajena')).toHaveCount(0)
    }
  })
})
