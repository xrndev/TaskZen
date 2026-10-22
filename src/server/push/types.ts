export interface PushPayload {
  title: string
  body: string
  /** Ruta interna que se abre al tocar el aviso, por ejemplo /board?task=<id>. */
  url: string
  /** Avisos con la misma etiqueta se sustituyen entre sí en el dispositivo. */
  tag?: string
}

/** `webpush`: navegador (`endpoint` es la URL del servicio de push). `fcm`: app nativa (`endpoint` es el token de FCM). */
export type PushKind = 'webpush' | 'fcm'

export interface PushTarget {
  kind: PushKind
  endpoint: string
  /** Claves de cifrado; solo existen en Web Push. */
  p256dh: string | null
  auth: string | null
}

export type PushResult =
  | { ok: true }
  /** `gone`: el servicio de push dice que el destino ya no existe: hay que darlo de baja. */
  | { ok: false; gone: boolean; status?: number; message?: string }

/** Un canal de entrega. Hay uno por tipo de destino (Web Push, FCM); APNs sería uno más sin tocar el resto. */
export interface PushSender {
  send(target: PushTarget, payload: PushPayload): Promise<PushResult>
}
