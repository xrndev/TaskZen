import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSession } from '@/server/session'
import { getT } from '@/lib/i18n/server'
import { LoginForm, type Provider } from './LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return { title: t('login.metaTitle'), robots: { index: false, follow: false } }
}
// Solo rutas internas: evita redirecciones abiertas (//otro-sitio.com, https://...).
function safeNext(next?: string) {
  return next && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : '/board'
}

const ERRORS: Record<string, 'login.cancelled'> = {
  access_denied: 'login.cancelled',
}

export default async function LoginPage(props: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await props.searchParams
  const { t } = await getT()
  const next = safeNext(params.next)
  if (await getSession()) redirect(next)

  const providers: Provider[] = [
    ...(process.env.GOOGLE_CLIENT_ID ? (['google'] as const) : []),
    ...(process.env.MICROSOFT_CLIENT_ID ? (['microsoft'] as const) : []),
    ...(process.env.GITHUB_CLIENT_ID ? (['github'] as const) : []),
  ]
  const initialError = params.error ? t(ERRORS[params.error] ?? 'login.closed') : null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 relative">
      <LoginForm providers={providers} next={next} invited={next.startsWith('/invite/')} initialError={initialError} />
    </div>
  )
}
