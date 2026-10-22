import { z } from 'zod'
import { ServiceError } from '@/server/services/common'

/**
 * Capa de casos de uso: la única que valida entradas y orquesta servicios + efectos (avisos, archivos).
 * No sabe nada del transporte: la usan por igual las server actions de la web y la API HTTP (`/api/v1`) de la app.
 * Reciben `unknown` en lo que llega de fuera y lo validan aquí, para que las reglas existan una sola vez.
 */
export const uuid = z.uuid()
export const roleSchema = z.enum(['admin', 'product_owner', 'member'])

/** Identificador recibido. Uno mal formado se trata como inexistente (no se distingue de "no tienes acceso"). */
export function parseId(value: unknown): string {
  const r = uuid.safeParse(value)
  if (!r.success) throw new ServiceError('NOT_FOUND', 'No encontrado.')
  return r.data
}

/** Archivo recibido en un formulario multipart. */
export function requireFile(value: unknown): File {
  if (!(value instanceof File)) throw new ServiceError('INVALID', 'Falta el archivo.')
  return value
}
