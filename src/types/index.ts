export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TeamRole = 'admin' | 'product_owner' | 'member';

export interface Attachment {
  id: string;
  task_id: string | null;
  comment_id: string | null;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  size: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  color: string;
  parent_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  is_personal?: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  profile?: Profile;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  /** Columna del tablero; `null` solo en datos antiguos (se muestra en la primera de su estado). */
  column_id?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
  due_date?: string | null;
  team_id?: string | null;
  assigned_to?: string | null;
  tags?: Tag[];
  assignee?: Profile | null;
  comment_count?: number;
  attachment_count?: number;
  /** Lista de comprobación: total y hechas (el detalle se pide al abrir la tarea). */
  subtask_total?: number;
  subtask_done?: number;
  attachments?: Attachment[];
}

/** Columna (estado) del tablero. `name` nulo = una de las tres de serie, que se muestra con el nombre traducido. */
export interface BoardColumn {
  id: string;
  team_id: string;
  name: string | null;
  kind: TaskStatus;
  color: string | null;
  position: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profile?: Profile;
  replies?: TaskComment[];
  attachments?: Attachment[];
}
