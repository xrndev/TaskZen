import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, loadToken, setUnauthorizedHandler, signInWithPassword, signOut as apiSignOut } from './api'
import type { Profile } from './types'

type State = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: Profile }

interface SessionValue {
  state: State
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const refresh = useCallback(async () => {
    setState({ status: 'in', user: await api<Profile>('GET', '/me') })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: 'out' }))
    void (async () => {
      if (!(await loadToken())) return setState({ status: 'out' })
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
        await signInWithPassword(email, password)
        await refresh()
      },
      signOut: async () => {
        await apiSignOut()
        setState({ status: 'out' })
      },
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
