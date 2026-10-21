import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ALLOWED_TYPES } from '@/server/services/attachments'
import { ServiceError } from '@/server/services/common'

const root = () => path.resolve(process.env.UPLOADS_DIR ?? './uploads')

/** Resuelve una clave dentro de UPLOADS_DIR e impide salir de ella (path traversal). */
function resolveKey(key: string) {
  const full = path.resolve(root(), key)
  if (!full.startsWith(root() + path.sep)) throw new ServiceError('INVALID', 'Ruta de archivo no válida.')
  return full
}

type Kind = 'png' | 'jpg' | 'gif' | 'webp' | 'pdf' | 'zip' | 'text'

/** Detecta el tipo real por los primeros bytes; el MIME que declara el navegador no es de fiar. */
export function sniff(buf: Buffer): Kind | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b)
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (starts(0xff, 0xd8, 0xff)) return 'jpg'
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'gif'
  if (starts(0x52, 0x49, 0x46, 0x46) && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  if (starts(0x25, 0x50, 0x44, 0x46)) return 'pdf'
  if (starts(0x50, 0x4b, 0x03, 0x04)) return 'zip'
  const head = buf.subarray(0, 1024)
  if (buf.length > 0 && !head.includes(0)) return 'text'
  return null
}

const MIME_BY_KIND: Record<Kind, (m: string) => boolean> = {
  png: (m) => m === 'image/png',
  jpg: (m) => m === 'image/jpeg',
  gif: (m) => m === 'image/gif',
  webp: (m) => m === 'image/webp',
  pdf: (m) => m === 'application/pdf',
  zip: (m) => m === 'application/zip' || m.includes('openxmlformats'),
  text: (m) => m === 'text/plain' || m === 'text/csv',
}

export async function saveUpload(
  file: File,
  opts: { dir: 'attachments' | 'avatars' | 'covers'; maxSize: number; imagesOnly?: boolean },
) {
  if (file.size === 0) throw new ServiceError('INVALID', 'El archivo está vacío.')
  if (file.size > opts.maxSize) {
    throw new ServiceError('INVALID', `El archivo supera el límite de ${Math.round(opts.maxSize / 1024 / 1024)} MB.`)
  }
  const declared = file.type
  if (!(declared in ALLOWED_TYPES)) throw new ServiceError('INVALID', 'Tipo de archivo no permitido.')
  const buf = Buffer.from(await file.arrayBuffer())
  const kind = sniff(buf)
  if (!kind || !MIME_BY_KIND[kind](declared)) throw new ServiceError('INVALID', 'El contenido no coincide con el tipo de archivo.')
  if (opts.imagesOnly && !['png', 'jpg', 'gif', 'webp'].includes(kind)) {
    throw new ServiceError('INVALID', 'Solo se admiten imágenes (PNG, JPG, GIF o WebP).')
  }

  const key = `${opts.dir}/${randomUUID()}${ALLOWED_TYPES[declared]}`
  const full = resolveKey(key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, buf)
  return { key, type: declared, size: file.size }
}

export async function readUpload(key: string) {
  return readFile(resolveKey(key))
}

/** Borrado de mejor esfuerzo: un archivo ya ausente no es un error. */
export async function removeUploads(keys: string[]) {
  await Promise.all(keys.map((k) => rm(resolveKey(k), { force: true }).catch(() => undefined)))
}
