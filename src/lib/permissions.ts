import type { TeamRole } from '../types'

export type Action =
  | 'task:create'
  | 'task:edit'
  | 'task:move'
  | 'task:delete'
  | 'tag:create'
  | 'tag:manage'
  | 'comment:create'
  | 'comment:delete'
  | 'attachment:upload'
  | 'attachment:delete'
  | 'team:view'
  | 'team:manage_members'
  | 'team:delete'

export interface Resource {
  /** Autor del recurso (tarea, comentario, adjunto). */
  ownerId?: string | null
  /** Persona a la que está asignada la tarea. */
  assignedTo?: string | null
}

const MANAGERS: TeamRole[] = ['admin', 'product_owner']

/**
 * Única fuente de verdad de autorización. `role` es el rol del usuario en el
 * equipo dueño del recurso, o null si no es miembro (siempre se deniega).
 */
export function can(userId: string, role: TeamRole | null, action: Action, res: Resource = {}): boolean {
  if (!role) return false
  const manager = MANAGERS.includes(role)
  const owner = res.ownerId === userId
  const assigned = res.assignedTo === userId

  switch (action) {
    case 'team:view':
    case 'task:create':
    case 'tag:create':
    case 'comment:create':
    case 'attachment:upload':
      return true
    case 'task:edit':
    case 'task:move':
      return manager || owner || assigned
    case 'task:delete':
      return manager || owner
    case 'tag:manage':
      return manager || owner
    case 'comment:delete':
    case 'attachment:delete':
      return manager || owner
    case 'team:manage_members':
    case 'team:delete':
      return role === 'admin'
  }
}
