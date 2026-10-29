import { expect, test } from '@playwright/test'
import { seedUser, signIn, type TestUser } from './helpers'

const run = Date.now().toString(36)
const ines: TestUser = { name: 'Ines E2E', email: `ines-${run}@e2e.dev`, password: 'e2e-password-9' }

test('un tablero vacío guía al usuario y se rellena con una plantilla', async ({ page }) => {
  await seedUser(ines)
  await signIn(page, ines)

  const guia = page.getByRole('region', { name: 'Primeros pasos' })
  await expect(guia).toBeVisible()
  await expect(guia).toContainText('Tu tablero está vacío')

  await guia.getByRole('button', { name: 'Sprint de equipo' }).click()
  await expect(page.getByText('Diseñar la pantalla de inicio').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Primeros pasos' })).toHaveCount(0) // ya no está vacío
})
