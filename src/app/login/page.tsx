import { redirect } from 'next/navigation'
import { getSession } from '@/server/session'
import { LoginForm, type Provider } from './LoginForm'

// Solo rutas internas: evita redirecciones abiertas (//otro-sitio.com, https://...).
function safeNext(next?: string) {
  return next && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : '/board'
}

const ERRORS: Record<string, string> = {
  access_denied: 'Cancelaste el acceso con el proveedor.',
}
const REGISTRATION_CLOSED = 'No se pudo entrar. Si es tu primera vez, el registro es solo por invitación: abre el enlace que te enviaron y vuelve a intentarlo.'

export default async function LoginPage(props: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await props.searchParams
  const next = safeNext(params.next)
  if (await getSession()) redirect(next)

  const providers: Provider[] = [
    ...(process.env.GOOGLE_CLIENT_ID ? (['google'] as const) : []),
    ...(process.env.MICROSOFT_CLIENT_ID ? (['microsoft'] as const) : []),
    ...(process.env.GITHUB_CLIENT_ID ? (['github'] as const) : []),
  ]
  const initialError = params.error ? (ERRORS[params.error] ?? REGISTRATION_CLOSED) : null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 relative">
      <LoginForm providers={providers} next={next} invited={next.startsWith('/invite/')} initialError={initialError} />
    </div>
  )
}
