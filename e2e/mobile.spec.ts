import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { seedUser, signIn, type TestUser } from './helpers'

// Móvil de verdad: pantalla de 390 px, táctil y sin teclado.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const run = Date.now().toString(36)
const frida: TestUser = { name: 'Frida E2E', email: `frida-${run}@e2e.dev`, password: 'e2e-password-6' }

test.describe.configure({ mode: 'serial' })

let page: Page
test.beforeAll(async ({ browser }) => {
  await seedUser(frida)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  page = await ctx.newPage()
})
test.afterAll(async () => {
  await page.close()
})

/** Sin violaciones WCAG A/AA (2.0, 2.1 y 2.2) y con todos los objetivos táctiles de al menos 44 px. */
async function expectAccessible(label: string) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(axe.violations.map((v) => `${label}: ${v.id} (${v.nodes.length})`), `axe en ${label}`).toEqual([])
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select')]
      .filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && (r.width < 44 || r.height < 44)
      })
      .map((e) => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40)),
  )
  expect(small, `objetivos menores de 44 px en ${label}`).toEqual([])
}

test('la interfaz de móvil sustituye a la de escritorio', async () => {
  await signIn(page, frida)
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nueva tarea' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Estado de las tareas' })).toBeVisible()
  // No hay desbordamiento horizontal de la página.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expectAccessible('tablero vacío')
})

test('crear con el botón flotante y mover con el menú de la tarjeta', async () => {
  await page.getByRole('button', { name: 'Nueva tarea' }).click()
  await page.getByPlaceholder(/Rediseñar/).fill('Tarea móvil')
  await page.getByRole('button', { name: 'Añadir al Tablero' }).click()

  const card = page.getByRole('button', { name: /Tarea móvil/ }).first()
  await expect(card).toBeVisible()
  await expect(page.getByRole('tab', { name: /Pending/ })).toContainText('1')
  await expectAccessible('tablero con una tarea')

  // Alternativa a arrastrar: el menú de la tarjeta.
  await page.getByRole('button', { name: /Acciones de la tarea Tarea móvil/ }).click()
  await expectAccessible('menú de la tarjeta')
  await page.getByRole('button', { name: /In Progress/ }).click()
  await expect(page.getByRole('tab', { name: /Pending/ })).toContainText('0')
  await expect(page.getByRole('tab', { name: /In Progress/ })).toContainText('1')
  await page.getByRole('tab', { name: /In Progress/ }).click()
  await expect(page.getByRole('button', { name: /Tarea móvil/ }).first()).toBeVisible()

  // El cambio persiste en el servidor.
  await page.reload()
  await page.getByRole('tab', { name: /In Progress/ }).click()
  await expect(page.getByRole('button', { name: /Tarea móvil/ }).first()).toBeVisible()
})

test('buscar, filtrar y borrar con confirmación', async () => {
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.getByLabel('Buscar tareas').fill('no existe')
  await page.getByRole('button', { name: 'Cerrar búsqueda' }).click()
  await expect(page.getByText(/No hay tareas en/)).toBeVisible()
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await page.getByLabel('Buscar tareas').fill('')
  await page.getByRole('button', { name: 'Cerrar búsqueda' }).click()

  await page.getByRole('button', { name: /^Filtros/ }).click()
  await expectAccessible('hoja de filtros')
  await page.getByRole('button', { name: 'Etiqueta', exact: true }).click()
  await page.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page.getByRole('tablist')).toHaveCount(0) // por etiqueta no hay pestañas de estado
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByRole('button', { name: 'Estado', exact: true }).click()
  await page.getByRole('button', { name: 'Ver resultados' }).click()

  await page.getByRole('tab', { name: /In Progress/ }).click()
  await page.getByRole('button', { name: /Acciones de la tarea Tarea móvil/ }).click()
  await page.getByRole('button', { name: 'Eliminar tarea' }).click()
  await expect(page.getByText(/Se borrarán también sus comentarios/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('button', { name: 'Eliminar tarea' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page.getByRole('tab', { name: /In Progress/ })).toContainText('0')
})

test('lista, calendario y menú Más', async () => {
  await page.getByRole('button', { name: 'Lista' }).click()
  await expectAccessible('lista')
  await page.getByRole('button', { name: 'Calendario' }).click()
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeVisible()
  await expectAccessible('calendario')
  await page.getByRole('button', { name: 'Más' }).click()
  await expect(page.getByRole('dialog', { name: 'Más opciones' })).toBeVisible()
  await expectAccessible('menú Más')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
