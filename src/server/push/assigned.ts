import { db } from '@/server/db'
import { getPushSender } from '@/server/push/sender'
import { notifyTaskAssigned } from '@/server/services/notifications'

/**
 * Avisa a quien recibe una tarea. Es "lo mejor posible": nunca retrasa ni hace fallar la acción que lo origina
 * (guardar la tarea es lo importante). Sin claves VAPID configuradas no hace nada.
 */
export function notifyAssignedInBackground(actorId: string, taskId: string) {
  const sender = getPushSender()
  if (!sender) return
  void notifyTaskAssigned(db, sender, { actorId, taskId }).catch((e) => console.error('[push] aviso de asignación', e))
}
