import { Client } from 'pg'

type Listener = (teamId: string) => void

interface State {
  listeners: Set<Listener>
  client: Promise<Client> | null
}

const g = globalThis as unknown as { __rt?: State }
const state: State = (g.__rt ??= { listeners: new Set(), client: null })

/** Una única conexión LISTEN por proceso reparte los avisos a todos los clientes SSE. */
function connect(): Promise<Client> {
  if (state.client) return state.client
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  const reset = () => {
    state.client = null
    client.removeAllListeners()
    client.end().catch(() => undefined)
  }
  state.client = client
    .connect()
    .then(() => client.query('LISTEN team_events'))
    .then(() => {
      client.on('notification', (m) => {
        if (m.payload) for (const fn of state.listeners) fn(m.payload)
      })
      client.on('error', reset)
      client.on('end', reset)
      return client
    })
    .catch((e) => {
      reset()
      throw e
    })
  return state.client
}

export async function subscribe(fn: Listener): Promise<() => void> {
  await connect()
  state.listeners.add(fn)
  return () => {
    state.listeners.delete(fn)
  }
}
