import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const FAKE_FINGERPRINT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'

test('assetlinks.json asocia el dominio con la app firmada y descarta huellas mal formadas', async ({ request }) => {
  const res = await request.get('/.well-known/assetlinks.json')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/json')
  const body = await res.json()
  expect(body).toHaveLength(1)
  expect(body[0].relation).toEqual(['delegate_permission/common.handle_all_urls'])
  expect(body[0].target).toMatchObject({ namespace: 'android_app', package_name: 'io.github.xrndev.taskzen' })
  // Solo la huella válida: la de prueba mal formada (configurada en playwright.config.ts) se descarta.
  expect(body[0].target.sha256_cert_fingerprints).toEqual([FAKE_FINGERPRINT])
})

for (const [name, viewport] of [['escritorio', { width: 1280, height: 800 }], ['móvil', { width: 390, height: 844 }]] as const) {
  test(`/instalar explica Android y iPhone y es accesible (${name})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport, hasTouch: name === 'móvil', isMobile: name === 'móvil' })
    const page = await ctx.newPage()
    await page.goto('/instalar')

    await expect(page.getByRole('heading', { name: 'Instala TaskZen en tu móvil' })).toBeVisible()
    const apk = page.getByRole('link', { name: /Descargar la app/ })
    await expect(apk).toHaveAttribute('href', '/descargas/TaskZen.apk')
    await expect(page.getByRole('heading', { name: 'iPhone y iPad' })).toBeVisible()
    await expect(page.getByText('Añadir a pantalla de inicio').first()).toBeVisible()
    await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
    expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([])
    await ctx.close()
  })
}

test('el login enlaza con la página de instalación sin necesidad de sesión', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Instalar la app en el móvil' }).click()
  await expect(page).toHaveURL(/\/instalar$/)
})
