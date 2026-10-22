import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import * as ImagePicker from 'expo-image-picker'
import * as Sharing from 'expo-sharing'
import type { Attachment } from '@domain/types'
import { API_URL, authHeaders, currentCookie, type PickedFile } from './api'

export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** Elige un archivo cualquiera. Devuelve null si se cancela; lanza si supera el límite del servidor. */
export async function pickDocument(): Promise<PickedFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true })
  if (r.canceled || !r.assets[0]) return null
  const a = r.assets[0]
  if (a.size && a.size > MAX_FILE_BYTES) throw new Error('El archivo supera los 10 MB')
  return { uri: a.uri, name: a.name, mimeType: a.mimeType }
}

/** Elige una imagen de la galería. */
export async function pickImage(): Promise<PickedFile | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
  if (r.canceled || !r.assets[0]) return null
  const a = r.assets[0]
  return { uri: a.uri, name: a.fileName ?? `imagen-${Date.now()}.jpg`, mimeType: a.mimeType ?? 'image/jpeg' }
}

/** Descarga un adjunto con la sesión y abre el menú de compartir / guardar del sistema. */
export async function downloadAttachment(att: Pick<Attachment, 'id' | 'file_name'>) {
  await currentCookie()
  const dir = new Directory(Paths.cache, 'adjuntos')
  if (!dir.exists) dir.create()
  const target = new File(dir, att.file_name)
  if (target.exists) target.delete()
  const file = await File.downloadFileAsync(`${API_URL}/api/files/${att.id}`, target, { headers: authHeaders() })
  await Sharing.shareAsync(file.uri, { dialogTitle: att.file_name })
}
