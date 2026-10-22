export interface PushPayload {
  title: string
  body: string
  /** Ruta interna que se abre al tocar el aviso, por ejemplo /board?task=<id>. */
  url: string
  /** Avisos con la misma etiqueta se sustituyen entre sí en el dispositivo. */
  tag?: string
}

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushResult =
  | { ok: true }
  /** `gone`: el servicio de push dice que la suscripción ya no existe (404/410): hay que darla de baja. */
  | { ok: false; gone: boolean; status?: number; message?: string }

/** Un canal de entrega. Hoy Web Push; mañana podría haber FCM/APNs sin cambiar el resto. */
export interface PushSender {
  send(target: PushTarget, payload: PushPayload): Promise<PushResult>
}
