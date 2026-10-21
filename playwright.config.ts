import { defineConfig } from '@playwright/test'

const PORT = 3100
// Con E2E_BASE_URL las pruebas se ejecutan contra un despliegue ya existente.
const REMOTE = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: REMOTE ?? `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: REMOTE ? undefined : {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      UPLOADS_DIR: './uploads-e2e',
      // Registro cerrado, igual que en producción: las cuentas de partida se siembran en la base de datos.
      ALLOW_OPEN_SIGNUP: 'false',
    },
  },
})
