import { getSessionCookie } from 'better-auth/cookies'
import { NextResponse, type NextRequest } from 'next/server'

// Comprobación optimista (solo mira que exista la cookie) para redirigir sin ir a la base de datos.
// La validación real de la sesión se hace en cada página y acción del servidor.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = !!getSessionCookie(request)

  if (!hasSession && pathname.startsWith('/board')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/board/:path*'],
}
