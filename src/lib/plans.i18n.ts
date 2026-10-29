/**
 * Traducción del catálogo de planes. `plans.ts` sigue siendo la fuente (en español, y lo comparte la app nativa);
 * aquí solo se traducen los textos para mostrarlos. Código puro.
 */
import type { Lang } from './i18n/core'
import { PLANS, type ComparisonRow, type PlanId, type TeamPlan, type UserPlan } from './plans'

interface PlanText { name: string; tagline: string; highlights: string[]; soon: string[] }

const EN: Record<PlanId, PlanText> = {
  team_free: {
    name: 'Team Free', tagline: 'To get started with your group.',
    highlights: ['Up to 5 members per team', '3 board columns (you can rename them)', '100 MB of attachments (files up to 10 MB)', 'Board, list and calendar views', 'Tags, comments and reminders'],
    soon: [],
  },
  team_plus: {
    name: 'Team Plus', tagline: 'For teams that already work every day.',
    highlights: ['Up to 15 members per team', 'Up to 6 board columns', '5 GB of attachments (files up to 25 MB)', 'Export the board to CSV'],
    soon: ['Templates and recurring tasks', 'Full history of each task'],
  },
  team_pro: {
    name: 'Team Pro', tagline: 'For organisations without limits.',
    highlights: ['Unlimited members', 'Up to 10 board columns', '50 GB of attachments (files up to 50 MB)', 'Export to CSV and a full JSON copy', 'Personal Plus included for every member'],
    soon: ['Simple automations', 'Audit log'],
  },
  user_free: {
    name: 'Personal Free', tagline: 'Everything essential, no expiry.',
    highlights: ['1 own team besides your personal space', '3 columns on your personal board', '2 reminders before the due date', '100 MB in your personal space (files up to 10 MB)', 'All 5 colour themes'],
    soon: [],
  },
  user_plus: {
    name: 'Personal Plus', tagline: 'For people who live in their board.',
    highlights: ['Up to 5 own teams', 'Up to 6 columns on your personal board', '4 reminders before the due date', '2 GB in your personal space (files up to 25 MB)', 'Export your tasks to CSV'],
    soon: ['Daily or weekly summary by notification', 'Saved views and filters', 'Private notes'],
  },
  user_pro: {
    name: 'Personal Pro', tagline: 'All the personal features, no cap.',
    highlights: ['Unlimited own teams', 'Up to 10 columns on your personal board', '6 reminders before the due date', '5 GB in your personal space', 'Export to CSV and a full JSON copy'],
    soon: ['Sync with your calendar', 'Weekly planning assistant'],
  },
}

/** El plan con sus textos en el idioma pedido (en español, tal cual). */
export function localizePlan<P extends TeamPlan | UserPlan>(plan: P, lang: Lang): P {
  if (lang === 'es') return plan
  const text = EN[plan.id]
  // Si el catálogo en español cambia de longitud y la traducción no, mejor español que un texto equivocado.
  if (text.highlights.length !== plan.highlights.length || text.soon.length !== plan.soon.length) return plan
  return { ...plan, ...text }
}

export const localizedPlan = (id: PlanId, lang: Lang) => localizePlan(PLANS[id], lang)

const ROWS_EN: Record<string, { label: string; hint?: string }> = {
  'Miembros por equipo': { label: 'Members per team' },
  'Columnas del tablero': { label: 'Board columns', hint: 'Task statuses, such as “In review” or “Blocked”. The three defaults count.' },
  'Adjuntos compartidos': { label: 'Shared attachments' },
  'Tamaño máximo por archivo': { label: 'Maximum file size' },
  'Tareas, etiquetas y comentarios': { label: 'Tasks, tags and comments' },
  'Tablero, lista y calendario': { label: 'Board, list and calendar' },
  'Avisos de vencimiento y de asignación': { label: 'Due-date and assignment reminders' },
  'Exportar el tablero a CSV': { label: 'Export the board to CSV' },
  'Copia completa del equipo (JSON)': { label: 'Full team copy (JSON)' },
  'Personal Plus gratis para cada miembro': { label: 'Personal Plus free for every member' },
  'Plantillas y tareas repetitivas': { label: 'Templates and recurring tasks' },
  'Historial completo de cada tarea': { label: 'Full history of each task' },
  'Automatizaciones sencillas': { label: 'Simple automations' },
  'Registro de auditoría': { label: 'Audit log' },
  'Equipos propios': { label: 'Own teams' },
  'Columnas en tu tablero personal': { label: 'Columns on your personal board' },
  'Recordatorios antes del vencimiento': { label: 'Reminders before the due date', hint: 'You choose how far ahead we warn you of a deadline (for example, 1 day and 1 hour before).' },
  'Adjuntos en tu espacio personal': { label: 'Attachments in your personal space' },
  'Los 5 temas de color': { label: 'All 5 colour themes' },
  'Exportar tus tareas a CSV': { label: 'Export your tasks to CSV' },
  'Copia completa de tus datos (JSON)': { label: 'Full copy of your data (JSON)' },
  'Resumen diario o semanal': { label: 'Daily or weekly summary' },
  'Vistas y filtros guardados': { label: 'Saved views and filters' },
  'Notas privadas': { label: 'Private notes' },
  'Sincronizar con tu calendario': { label: 'Sync with your calendar' },
  'Asistente de planificación': { label: 'Planning assistant' },
}
const CELLS_EN: Record<string, string> = { Ilimitados: 'Unlimited', 'Sin límite': 'No limit' }

export function localizeRows(rows: ComparisonRow[], lang: Lang): ComparisonRow[] {
  if (lang === 'es') return rows
  return rows.map((r) => {
    const t = ROWS_EN[r.label]
    return {
      label: t?.label ?? r.label,
      hint: r.hint ? (t?.hint ?? r.hint) : undefined,
      cells: r.cells.map((c) => (typeof c === 'string' && c in CELLS_EN ? CELLS_EN[c] : c)),
    }
  })
}
