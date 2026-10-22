import { authClient } from './auth-client'
import { API_URL } from './config'

export { API_URL }

let onUnauthorized: (() => void) | null = null
let cookieCache = ''

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

/** Lee la sesión del almacén seguro y la deja en memoria (las imágenes se piden de forma síncrona). */
export async function currentCookie() {
  cookieCache = (await authClient.getCookie()) ?? ''
  return cookieCache
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function send(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  const cookie = await currentCookie()
  if (cookie) headers.set('Cookie', cookie)
  try {
    // `omit`: la cookie se manda a mano; con `include` el sistema podría pisarla.
    return await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'omit' })
  } catch {
    throw new ApiError('No hay conexión con el servidor.', 0)
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as { data?: T; error?: string } | null
  if (res.status === 401) onUnauthorized?.()
  if (!res.ok) throw new ApiError(json?.error ?? 'Ha ocurrido un error inesperado.', res.status)
  return json?.data as T
}

/** Llama a /api/v1 con cuerpo JSON. Devuelve `data` o lanza ApiError con el mensaje que da el servidor. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = body === undefined ? {} : { 'Content-Type': 'application/json' }
  return unwrap<T>(await send(`/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }))
}

export interface PickedFile { uri: string; name: string; mimeType?: string | null }

/** Sube un archivo (multipart) a /api/v1. `fields` son los campos de texto que lo acompañan. */
export async function upload<T>(path: string, file: PickedFile, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData()
  // React Native admite este formato de archivo en FormData.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob)
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  return unwrap<T>(await send(`/api/v1${path}`, { method: 'POST', body: form }))
}

/** Origen absoluto para URLs relativas del servidor (`/api/media/...`). */
export const absolute = (uri: string) => (uri.startsWith('/') ? `${API_URL}${uri}` : uri)

/** Fuente de imagen con la sesión adjunta (algunas rutas del servidor exigen estar identificado). */
export function imageSource(uri: string) {
  const local = uri.startsWith('/')
  return { uri: absolute(uri), headers: local && cookieCache ? { Cookie: cookieCache } : undefined }
}

export const authHeaders = (): Record<string, string> => (cookieCache ? { Cookie: cookieCache } : {})
