/**
 * Catálogo de planes de Serenboard. Código puro (sin framework ni `@/...`): lo comparten los servicios (que aplican
 * los límites), la web, la landing y, por ser importable como `@domain/lib/plans`, también la app nativa.
 *
 * Hay dos capas que se acumulan:
 *  - Plan de EQUIPO (`team_*`): lo paga el equipo; manda en miembros y espacio compartido.
 *  - Plan PERSONAL (`user_*`): lo paga la persona; la acompaña a cualquier equipo.
 *
 * Solo lo que está en `limits` y en `highlights` existe y se aplica de verdad. Lo que aún no está construido
 * va en `soon` (se muestra como «Próximamente», nunca como incluido).
 */

export const TRIAL_DAYS = 14

const MB = 1024 * 1024
const GB = 1024 * MB

export type TeamPlanId = 'team_free' | 'team_plus' | 'team_pro'
export type UserPlanId = 'user_free' | 'user_plus' | 'user_pro'
export type PlanId = TeamPlanId | UserPlanId
export type PlanScope = 'team' | 'user'

export interface TeamLimits {
  /** `null` = sin límite. */
  maxMembers: number | null
  storageBytes: number
  /** Tamaño máximo de cada archivo adjunto. */
  maxFileBytes: number
  exportCsv: boolean
  exportFull: boolean
}

export interface UserLimits {
  /** Equipos propios (sin contar el espacio personal). `null` = sin límite. */
  maxOwnedTeams: number | null
  /** Recordatorios distintos antes del vencimiento de una tarea (por ejemplo, 1 día y 1 hora antes = 2). */
  maxReminderOffsets: number
  /** Adjuntos en el espacio personal. */
  personalStorageBytes: number
  /** Tamaño máximo de cada archivo adjunto en tu espacio personal. */
  maxFileBytes: number
  exportCsv: boolean
  exportFull: boolean
}

interface PlanBase {
  name: string
  tagline: string
  /** Euros. `null` = gratis. */
  monthly: number | null
  yearly: number | null
  /** Lo que de verdad incluye, en lenguaje llano. */
  highlights: string[]
  /** Planificado, aún no disponible. */
  soon: string[]
  featured?: boolean
  /** `false` = existe y se puede conceder, pero no se anuncia (aún no aporta valor propio). */
  listed?: boolean
}
export interface TeamPlan extends PlanBase { id: TeamPlanId; scope: 'team'; limits: TeamLimits }
export interface UserPlan extends PlanBase { id: UserPlanId; scope: 'user'; limits: UserLimits }

export const TEAM_PLANS: Record<TeamPlanId, TeamPlan> = {
  team_free: {
    id: 'team_free', scope: 'team', name: 'Equipo Gratis', tagline: 'Para empezar con tu grupo.',
    monthly: null, yearly: null,
    limits: { maxMembers: 5, storageBytes: 100 * MB, maxFileBytes: 10 * MB, exportCsv: false, exportFull: false },
    highlights: ['Hasta 5 miembros por equipo', '100 MB de adjuntos (archivos de hasta 10 MB)', 'Tablero, lista y calendario', 'Etiquetas, comentarios y avisos'],
    soon: [],
  },
  team_plus: {
    id: 'team_plus', scope: 'team', name: 'Equipo Plus', tagline: 'Para equipos que ya trabajan a diario.',
    monthly: 5, yearly: 50, featured: true,
    limits: { maxMembers: 15, storageBytes: 5 * GB, maxFileBytes: 25 * MB, exportCsv: true, exportFull: false },
    highlights: ['Hasta 15 miembros por equipo', '5 GB de adjuntos (archivos de hasta 25 MB)', 'Exportar el tablero a CSV'],
    soon: ['Plantillas y tareas repetitivas', 'Historial completo de cada tarea'],
  },
  team_pro: {
    id: 'team_pro', scope: 'team', name: 'Equipo Pro', tagline: 'Para organizaciones sin límites.',
    monthly: 15, yearly: 150,
    limits: { maxMembers: null, storageBytes: 50 * GB, maxFileBytes: 50 * MB, exportCsv: true, exportFull: true },
    highlights: ['Miembros ilimitados', '50 GB de adjuntos (archivos de hasta 50 MB)', 'Exportar a CSV y copia completa en JSON', 'Personal Plus incluido para todos los miembros'],
    soon: ['Automatizaciones sencillas', 'Registro de auditoría'],
  },
}

export const USER_PLANS: Record<UserPlanId, UserPlan> = {
  user_free: {
    id: 'user_free', scope: 'user', name: 'Personal Gratis', tagline: 'Todo lo esencial, sin caducidad.',
    monthly: null, yearly: null,
    limits: { maxOwnedTeams: 1, maxReminderOffsets: 2, personalStorageBytes: 100 * MB, maxFileBytes: 10 * MB, exportCsv: false, exportFull: false },
    highlights: ['1 equipo propio además de tu espacio personal', '2 recordatorios antes del vencimiento', '100 MB en tu espacio personal (archivos de hasta 10 MB)', 'Los 5 temas de color'],
    soon: [],
  },
  user_plus: {
    id: 'user_plus', scope: 'user', name: 'Personal Plus', tagline: 'Para quien vive en su tablero.',
    monthly: 3, yearly: 30, featured: true,
    limits: { maxOwnedTeams: 5, maxReminderOffsets: 4, personalStorageBytes: 2 * GB, maxFileBytes: 25 * MB, exportCsv: true, exportFull: false },
    highlights: ['Hasta 5 equipos propios', '4 recordatorios antes del vencimiento', '2 GB en tu espacio personal (archivos de hasta 25 MB)', 'Exportar tus tareas a CSV'],
    soon: ['Resumen diario o semanal por aviso', 'Vistas y filtros guardados', 'Notas privadas'],
  },
  user_pro: {
    id: 'user_pro', scope: 'user', name: 'Personal Pro', tagline: 'Todo lo personal, sin tope.',
    monthly: 6, yearly: 60, listed: false, // se anunciará cuando tenga funciones propias (calendario, asistente): hoy solo difiere de Plus en cantidades
    limits: { maxOwnedTeams: null, maxReminderOffsets: 6, personalStorageBytes: 5 * GB, maxFileBytes: 50 * MB, exportCsv: true, exportFull: true },
    highlights: ['Equipos propios ilimitados', '6 recordatorios antes del vencimiento', '5 GB en tu espacio personal', 'Exportar a CSV y copia completa en JSON'],
    soon: ['Sincronizar con tu calendario', 'Asistente de planificación semanal'],
  },
}

export const PLANS: Record<PlanId, TeamPlan | UserPlan> = { ...TEAM_PLANS, ...USER_PLANS }
export const TEAM_PLAN_ORDER: TeamPlanId[] = ['team_free', 'team_plus', 'team_pro']
export const USER_PLAN_ORDER: UserPlanId[] = ['user_free', 'user_plus', 'user_pro']

/** Lo que se anuncia (tarjetas, tablas, pruebas). Un plan no listado sigue siendo válido y concedible a mano. */
export const TEAM_PLAN_LISTED: TeamPlanId[] = TEAM_PLAN_ORDER.filter((id) => TEAM_PLANS[id].listed !== false)
export const USER_PLAN_LISTED: UserPlanId[] = USER_PLAN_ORDER.filter((id) => USER_PLANS[id].listed !== false)

export const isTeamPlan = (p: string): p is TeamPlanId => p in TEAM_PLANS
export const isUserPlan = (p: string): p is UserPlanId => p in USER_PLANS
export const isPaidPlan = (p: PlanId) => p !== 'team_free' && p !== 'user_free'

/** El plan Pro de equipo regala este plan personal a todos sus miembros. */
export const TEAM_PRO_GIVES: UserPlanId = 'user_plus'

/** Elige el plan personal de mayor rango. */
export function bestUserPlan(...plans: UserPlanId[]): UserPlanId {
  return plans.reduce((a, b) => (USER_PLAN_ORDER.indexOf(b) > USER_PLAN_ORDER.indexOf(a) ? b : a), 'user_free' as UserPlanId)
}

/* ---------- Suscripciones ---------- */
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled'

export interface SubscriptionLike {
  plan: string
  status: SubscriptionStatus
  /** Fin de la prueba o del periodo pagado. `null` solo es válido en `active` (sin caducidad). */
  ends_at: string | null
}

/** ¿Concede acceso ahora mismo? Una prueba o una baja programada lo concede hasta `ends_at`; un plan activo, también sin fecha. */
export function isActive(sub: SubscriptionLike, now: Date = new Date()): boolean {
  if (sub.ends_at === null) return sub.status === 'active'
  return new Date(sub.ends_at).getTime() > now.getTime()
}

/* ---------- Estado que ven los clientes ---------- */
export interface PlanState {
  status: 'free' | SubscriptionStatus
  ends_at: string | null
  /** Aún no ha usado nunca la prueba gratuita. */
  trial_available: boolean
  /** Un plan o prueba que ya terminó (para avisar de ello una vez). */
  ended: { plan: PlanId; ended_at: string; trial: boolean } | null
}

export interface TeamBilling extends PlanState {
  scope: 'team'
  plan: TeamPlanId
  limits: TeamLimits
  usage: { members: number; storage_bytes: number }
  /** Quien lo ve puede iniciar pruebas y exportar. */
  is_admin: boolean
  can_export: boolean
  /** Espacio personal: no tiene plan propio, usa el de su dueño. */
  personal: boolean
}

export interface UserBilling {
  scope: 'user'
  /** Plan efectivo (el mejor entre el propio y el que regala un equipo Pro). */
  plan: UserPlanId
  source: 'own' | 'team' | 'free'
  own: PlanState & { plan: UserPlanId }
  limits: UserLimits
  usage: { owned_teams: number; storage_bytes: number }
}

/* ---------- Presentación ---------- */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${+(bytes / GB).toFixed(1)} GB`
  return `${Math.round(bytes / MB)} MB`
}

export function formatPrice(eur: number | null): string {
  return eur === null ? '0 €' : `${eur % 1 === 0 ? eur : eur.toFixed(2).replace('.', ',')} €`
}

/** Celda de la tabla comparativa: texto, incluido / no incluido, o próximamente. */
export type Cell = string | boolean | 'soon'
export interface ComparisonRow { label: string; cells: Cell[]; /** Aclaración corta bajo la etiqueta. */ hint?: string }

const lim = (n: number | null) => (n === null ? 'Ilimitados' : String(n))

export function teamComparison(): ComparisonRow[] {
  const [f, p, r] = TEAM_PLAN_ORDER.map((id) => TEAM_PLANS[id].limits)
  return [
    { label: 'Miembros por equipo', cells: [lim(f.maxMembers), lim(p.maxMembers), lim(r.maxMembers)] },
    { label: 'Adjuntos compartidos', cells: [formatBytes(f.storageBytes), formatBytes(p.storageBytes), formatBytes(r.storageBytes)] },
    { label: 'Tamaño máximo por archivo', cells: [formatBytes(f.maxFileBytes), formatBytes(p.maxFileBytes), formatBytes(r.maxFileBytes)] },
    { label: 'Tareas, etiquetas y comentarios', cells: ['Sin límite', 'Sin límite', 'Sin límite'] },
    { label: 'Tablero, lista y calendario', cells: [true, true, true] },
    { label: 'Avisos de vencimiento y de asignación', cells: [true, true, true] },
    { label: 'Exportar el tablero a CSV', cells: [f.exportCsv, p.exportCsv, r.exportCsv] },
    { label: 'Copia completa del equipo (JSON)', cells: [f.exportFull, p.exportFull, r.exportFull] },
    { label: 'Personal Plus gratis para cada miembro', cells: [false, false, true] },
    { label: 'Plantillas y tareas repetitivas', cells: [false, 'soon', 'soon'] },
    { label: 'Historial completo de cada tarea', cells: [false, 'soon', 'soon'] },
    { label: 'Automatizaciones sencillas', cells: [false, false, 'soon'] },
    { label: 'Registro de auditoría', cells: [false, false, 'soon'] },
  ]
}

/** Solo las columnas de los planes anunciados; una fila que queda sin nada en ellas (todo «no») se omite. */
function onlyListed(rows: ComparisonRow[]): ComparisonRow[] {
  const keep = USER_PLAN_ORDER.map((id, i) => [id, i] as const).filter(([id]) => USER_PLAN_LISTED.includes(id)).map(([, i]) => i)
  return rows
    .map((r) => ({ ...r, cells: keep.map((i) => r.cells[i]) }))
    .filter((r) => r.cells.some((c) => c !== false))
}

export function userComparison(): ComparisonRow[] {
  const [f, p, r] = USER_PLAN_ORDER.map((id) => USER_PLANS[id].limits)
  return onlyListed([
    { label: 'Equipos propios', cells: [lim(f.maxOwnedTeams), lim(p.maxOwnedTeams), lim(r.maxOwnedTeams)] },
    { label: 'Recordatorios antes del vencimiento', hint: 'Eliges con qué antelación te avisamos de una fecha límite (por ejemplo, 1 día y 1 hora antes).', cells: [String(f.maxReminderOffsets), String(p.maxReminderOffsets), String(r.maxReminderOffsets)] },
    { label: 'Adjuntos en tu espacio personal', cells: [formatBytes(f.personalStorageBytes), formatBytes(p.personalStorageBytes), formatBytes(r.personalStorageBytes)] },
    { label: 'Tamaño máximo por archivo', cells: [formatBytes(f.maxFileBytes), formatBytes(p.maxFileBytes), formatBytes(r.maxFileBytes)] },
    { label: 'Tablero, lista y calendario', cells: [true, true, true] },
    { label: 'Los 5 temas de color', cells: [true, true, true] },
    { label: 'Exportar tus tareas a CSV', cells: [f.exportCsv, p.exportCsv, r.exportCsv] },
    { label: 'Copia completa de tus datos (JSON)', cells: [f.exportFull, p.exportFull, r.exportFull] },
    { label: 'Resumen diario o semanal', cells: [false, 'soon', 'soon'] },
    { label: 'Vistas y filtros guardados', cells: [false, 'soon', 'soon'] },
    { label: 'Notas privadas', cells: [false, 'soon', 'soon'] },
    { label: 'Sincronizar con tu calendario', cells: [false, false, 'soon'] },
    { label: 'Asistente de planificación', cells: [false, false, 'soon'] },
  ])
}
