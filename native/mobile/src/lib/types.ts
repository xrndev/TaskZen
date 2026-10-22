// Subconjunto de src/types de la web: lo que devuelve la API /api/v1.
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TeamRole = 'admin' | 'product_owner' | 'member'

export interface Tag { id: string; name: string; color: string }

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export interface Team { id: string; name: string; owner_id: string; is_personal?: boolean }

export interface TeamMember { id: string; user_id: string; role: TeamRole; profile?: Profile }

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  position: number
  due_date?: string | null
  assigned_to?: string | null
  tags?: Tag[]
  assignee?: Profile | null
  comment_count?: number
  attachment_count?: number
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  parent_id: string | null
  created_at: string
  profile?: Profile
  replies?: TaskComment[]
}

export const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'in_progress', label: 'En curso' },
  { key: 'completed', label: 'Hechas' },
]
