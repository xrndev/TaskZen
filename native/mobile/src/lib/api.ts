import { authClient } from './auth-client'
import { API_URL } from './config'

export { API_URL }

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function send(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  const cookie = await authClient.getCookie()
  if (cookie) headers.set('Cookie', cookie)
  try {
    // `omit`: la cookie se manda a mano; con `include` el sistema podría pisarla.
    return await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'omit' })
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0)
  }
}

/** Llama a /api/v1. Devuelve `data` o lanza ApiError con el mensaje que da el servidor. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(`/api/v1${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
  if (res.status === 401) onUnauthorized?.()
  if (!res.ok) throw new ApiError(json?.error ?? 'Ha ocurrido un error inesperado.', res.status)
  return json?.data as T
}
