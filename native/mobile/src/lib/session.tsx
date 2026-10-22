import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Profile } from '@domain/types'
import { currentCookie, setUnauthorizedHandler } from './api'
import { authClient } from './auth-client'
import { apiClient } from './client'
import { unregisterDevice } from './push'

type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: Profile }

export type Provider = 'google' | 'microsoft' | 'github'

interface SessionValue {
  state: State
  signIn: (email: string, password: string) => Promise<void>
  signInWith: (provider: Provider) => Promise<void>
  signOut: () => Promise<void>
  updateUser: (user: Profile) => void
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const refresh = useCallback(async () => {
    setState({ status: 'in', user: await apiClient.me() })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: 'out' }))
    void (async () => {
      if (!(await currentCookie())) return setState({ status: 'out' })
      try {
        await refresh()
      } catch {
        // Sin conexión también cuenta como "no sé quién eres": se vuelve a pedir el acceso.
        setState({ status: 'out' })
      }
    })()
    return () => setUnauthorizedHandler(null)
  }, [refresh])

  const value = useMemo<SessionValue>(
    () => ({
      state,
      signIn: async (email, password) => {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) throw new Error(error.status === 429 ? 'Demasiados intentos. Espera un minuto.' : 'Correo o contraseña incorrectos.')
        await refresh()
      },
      signInWith: async (provider) => {
        // Abre el navegador del sistema; al terminar, el servidor vuelve a la app por `taskzen://` con la sesión.
        const { error } = await authClient.signIn.social({ provider, callbackURL: '/' })
        if (error) throw new Error('No se pudo entrar con ese proveedor.')
        try {
          await refresh()
        } catch {
          // Cancelar en el navegador no es un error; un registro cerrado (sin invitación) sí.
          if (!(await currentCookie())) return
          throw new Error('No se pudo entrar. Si es tu primera vez, el registro es solo por invitación: abre el enlace que te enviaron.')
        }
      },
      signOut: async () => {
        await unregisterDevice() // este móvil deja de recibir los avisos de esta cuenta
        await authClient.signOut().catch(() => undefined)
        await currentCookie()
        setState({ status: 'out' })
      },
      updateUser: (user) => setState({ status: 'in', user }),
    }),
    [state, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession fuera de SessionProvider')
  return v
}

/** Usuario autenticado. Solo se usa dentro de las pantallas protegidas. */
export function useUser(): Profile {
  const { state } = useSession()
  if (state.status !== 'in') throw new Error('Sin sesión')
  return state.user
}
