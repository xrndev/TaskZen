import { expect, test, type Page } from '@playwright/test'
import { attachmentId, logOut, seedUser, signIn, type TestUser, visibleText } from './helpers'

// PNG de 1x1 píxel válido.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const run = Date.now().toString(36)
const alice: TestUser = { name: 'Alice E2E', email: `alice-${run}@e2e.dev`, password: 'e2e-password-1' }
const bob: TestUser = { name: 'Bob E2E', email: `bob-${run}@e2e.dev`, password: 'e2e-password-2' }

const column = (page: Page, title: string) =>
  page.locator('h2', { hasText: title }).locator('xpath=ancestor::div[contains(@class,"min-h-[500px]")]')

test.describe.configure({ mode: 'serial' })

let page: Page
test.beforeAll(async ({ browser }) => {
  await seedUser(alice)
  await seedUser(bob)
  page = await browser.newPage()
})
test.afterAll(async () => {
  await page.close()
})

test('rutas privadas redirigen al login', async () => {
  await page.goto('/board')
  await expect(page).toHaveURL(/\/login/)
})

test('tarea, arrastrar, comentar y adjuntar', async () => {
  await signIn(page, alice)

  await page.getByRole('button', { name: /New Task/ }).click()
  await page.getByPlaceholder(/Rediseñar/).fill('Mi primera tarea')
  await page.getByRole('button', { name: 'Añadir al Tablero' }).click()
  const card = visibleText(page, 'Mi primera tarea')
  await expect(card).toBeVisible()
  await expect(column(page, 'Pendiente')).toContainText('Mi primera tarea')

  // Arrastrar a "In Progress" y comprobar que persiste tras recargar.
  const from = await card.boundingBox()
  const to = await column(page, 'En curso').boundingBox()
  await page.mouse.move(from!.x + 20, from!.y + 10)
  await page.mouse.down()
  await page.mouse.move(from!.x + 40, from!.y + 30, { steps: 5 })
  await page.mouse.move(to!.x + to!.width / 2, to!.y + 150, { steps: 20 })
  await page.mouse.up()
  await expect(column(page, 'En curso')).toContainText('Mi primera tarea')
  await page.reload()
  await expect(column(page, 'En curso')).toContainText('Mi primera tarea')

  // Comentario y adjunto desde el panel de detalle.
  await visibleText(page, 'Mi primera tarea').click()
  await page.getByPlaceholder('Escribe un comentario...').fill('Un comentario de prueba')
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Un comentario de prueba')).toBeVisible()

  await page.locator('input[type="file"]').first().setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('pixel.png')).toBeVisible()
})

test('un archivo con contenido falso se rechaza', async () => {
  await page.goto('/board')
  await visibleText(page, 'Mi primera tarea').click()
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: Buffer.from('esto no es un png') })
  await expect(page.getByText(/no coincide con el tipo/i)).toBeVisible()
})

test('otro usuario no ve ni puede descargar lo de Alice', async ({ request }) => {
  await page.goto('/board')
  expect(await page.content()).toContain('Mi primera tarea')

  const id = await attachmentId('pixel.png')
  const own = await page.request.get(`/api/files/${id}`)
  expect(own.status()).toBe(200)
  expect(own.headers()['content-type']).toBe('image/png')
  expect(own.headers()['x-content-type-options']).toBe('nosniff')
  await logOut(page)

  expect((await request.get(`/api/files/${id}`)).status()).toBe(401)

  await signIn(page, bob)
  await expect(visibleText(page, 'Mi primera tarea')).toHaveCount(0)
  await expect(page.locator('option', { hasText: 'Personal · Bob E2E' }).first()).toBeAttached()
  await expect(page.locator('option', { hasText: 'Personal · Alice E2E' })).toHaveCount(0)

  // Bob tiene sesión pero el archivo es de un equipo al que no pertenece.
  expect((await page.request.get(`/api/files/${id}`)).status()).toBe(404)
})
