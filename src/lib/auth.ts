import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { bearer } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import * as schema from '@/db/schema'
import { db } from '@/server/db'
import { canRegister, INVITE_COOKIE, readCookie } from '@/server/services/registration'
import { ensurePersonalTeam } from '@/server/services/teams'

const isProd = process.env.NODE_ENV === 'production'

if (isProd && !process.env.BETTER_AUTH_SECRET && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('BETTER_AUTH_SECRET es obligatorio en producción.')
}

// Los passkeys quedan ligados al dominio (rpID): cambiar de dominio obliga a volver a registrarlos.
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const rpID = new URL(baseURL).hostname

const socialProviders = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
    ? { microsoft: { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET, tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common' } }
    : {}),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
    : {}),
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  // Sin correo: no hay verificación ni recuperación por email. Se recupera el acceso con un
  // proveedor (Google, Microsoft, GitHub) o un passkey, y la clave se cambia desde el perfil.
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders,
  // Los errores de los flujos de proveedor vuelven al login con ?error=...
  onAPIError: { errorURL: '/login' },
  plugins: [
    passkey({ rpID, rpName: 'TaskZen', origin: new URL(baseURL).origin }),
    bearer(), // clientes nativos: `Authorization: Bearer <token>` equivale a la cookie de sesión
    nextCookies(), // debe ir el último
  ],
  rateLimit: { enabled: isProd, window: 60, max: 30, customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 5 } } },
  databaseHooks: {
    user: {
      create: {
        // Registro solo por invitación. Se aplica aquí para cubrir todas las vías de creación de cuenta.
        before: async (u, ctx) => {
          const token = readCookie(ctx?.headers?.get('cookie'), INVITE_COOKIE)
          const allowed = await canRegister(db, { email: u.email, emailVerified: !!u.emailVerified, inviteToken: token })
          if (!allowed) {
            throw new APIError('FORBIDDEN', { message: 'El registro es solo por invitación. Pide un enlace a quien administra tu equipo.' })
          }
        },
        after: async (u) => {
          await ensurePersonalTeam(db, u.id, u.name)
        },
      },
    },
  },
})
