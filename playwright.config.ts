import { defineConfig } from '@playwright/test'
import webpush from 'web-push'

// Claves VAPID y clave del endpoint solo para pruebas: se generan al arrancar y no se guardan en ningún sitio.
const vapid = webpush.generateVAPIDKeys()
// Las pruebas leen la misma clave de process.env (los procesos de prueba heredan el entorno de esta configuración).
const E2E_TICK_SECRET = (process.env.E2E_TICK_SECRET ??= randomBytes(32).toString('base64url'))
import { randomBytes } from 'node:crypto'

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
    locale: 'es-ES', // la interfaz sigue el idioma del navegador; las pruebas esperan el español
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
      TICK_SECRET: E2E_TICK_SECRET,
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: 'mailto:e2e@serenboard.invalid',
      // Una huella válida y otra mal formada (debe descartarse): ver e2e/install.spec.ts
      ANDROID_SHA256_FINGERPRINTS: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99,no-es-una-huella',
    },
  },
})
