import * as SecureStore from 'expo-secure-store'

/** Servidor de TaskZen. Se cambia con EXPO_PUBLIC_API_URL al compilar (por ejemplo para probar en local). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://taskzen.duckdns.org').replace(/\/$/, '')

const TOKEN_KEY = 'taskzen.token'

let token: string | null = null
let onUnauthorized: (() => void) | null = null

export async function loadToken() {
  token = await SecureStore.getItemAsync(TOKEN_KEY)
  return token
}

export async function saveToken(value: string | null) {
  token = value
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value)
  else await SecureStore.deleteItemAsync(TOKEN_KEY)
}

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
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers })
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

/** Inicio de sesión con correo y contraseña de Better Auth; el token llega en la cabecera `set-auth-token`. */
export async function signInWithPassword(email: string, password: string) {
  const res = await send('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) })
  const json = (await res.json().catch(() => null)) as { message?: string } | null
  const value = res.headers.get('set-auth-token')
  if (!res.ok || !value) {
    throw new ApiError(res.status === 429 ? 'Demasiados intentos. Espera un minuto.' : json?.message ?? 'Correo o contraseña incorrectos.', res.status)
  }
  await saveToken(value)
}

export async function signOut() {
  await send('/api/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined)
  await saveToken(null)
}
