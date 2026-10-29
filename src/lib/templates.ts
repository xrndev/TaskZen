/**
 * Plantillas de tablero: etiquetas y tareas de ejemplo para no empezar en blanco. Código puro (sin framework),
 * como `plans.ts`. Se aplican solo a tableros vacíos; ver `services/templates.ts`.
 */
export type TemplateStatus = 'pending' | 'in_progress' | 'completed'

export interface TemplateTask {
  title: string
  description?: string
  status: TemplateStatus
  /** Nombre de una de las etiquetas de la plantilla. */
  tag?: string
  /** Días desde hoy hasta el vencimiento; sin valor, la tarea no tiene fecha. */
  dueInDays?: number
}

export interface BoardTemplate {
  id: string
  name: string
  description: string
  tags: { name: string; color: string }[]
  tasks: TemplateTask[]
}

export const BOARD_TEMPLATES = [
  {
    id: 'sprint',
    name: 'Sprint de equipo',
    description: 'Planifica un sprint de dos semanas con trabajo, errores y mejoras.',
    tags: [
      { name: 'Funcionalidad', color: '#3b82f6' },
      { name: 'Error', color: '#ef4444' },
      { name: 'Mejora', color: '#22c55e' },
    ],
    tasks: [
      { title: 'Definir el objetivo del sprint', description: 'Una frase que todo el equipo pueda repetir.', status: 'completed', tag: 'Mejora' },
      { title: 'Diseñar la pantalla de inicio', status: 'in_progress', tag: 'Funcionalidad', dueInDays: 5 },
      { title: 'Corregir el fallo al guardar el formulario', status: 'in_progress', tag: 'Error', dueInDays: 2 },
      { title: 'Escribir las pruebas del módulo de pagos', status: 'pending', tag: 'Mejora', dueInDays: 9 },
      { title: 'Preparar la demo para el cliente', status: 'pending', tag: 'Funcionalidad', dueInDays: 13 },
    ],
  },
  {
    id: 'marketing',
    name: 'Campaña de marketing',
    description: 'Del plan al lanzamiento: contenidos, redes y análisis.',
    tags: [
      { name: 'Contenido', color: '#a855f7' },
      { name: 'Redes', color: '#06b6d4' },
      { name: 'Análisis', color: '#f59e0b' },
    ],
    tasks: [
      { title: 'Definir público y mensaje', status: 'completed', tag: 'Análisis' },
      { title: 'Redactar la nota de prensa', status: 'in_progress', tag: 'Contenido', dueInDays: 3 },
      { title: 'Calendario de publicaciones', status: 'in_progress', tag: 'Redes', dueInDays: 4 },
      { title: 'Grabar el vídeo de presentación', status: 'pending', tag: 'Contenido', dueInDays: 8 },
      { title: 'Medir resultados de la primera semana', status: 'pending', tag: 'Análisis', dueInDays: 14 },
    ],
  },
  {
    id: 'personal',
    name: 'Mis tareas personales',
    description: 'Para organizar el día a día: casa, trabajo y estudios.',
    tags: [
      { name: 'Trabajo', color: '#3b82f6' },
      { name: 'Casa', color: '#22c55e' },
      { name: 'Estudios', color: '#f59e0b' },
    ],
    tasks: [
      { title: 'Revisar el correo y planificar la semana', status: 'completed', tag: 'Trabajo' },
      { title: 'Hacer la compra', status: 'pending', tag: 'Casa', dueInDays: 1 },
      { title: 'Preparar la presentación del jueves', status: 'in_progress', tag: 'Trabajo', dueInDays: 3 },
      { title: 'Leer el capítulo 4', status: 'pending', tag: 'Estudios', dueInDays: 6 },
    ],
  },
] as const satisfies readonly BoardTemplate[]

export type TemplateId = (typeof BOARD_TEMPLATES)[number]['id']
export const TEMPLATE_IDS = BOARD_TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]]
export const templateById = (id: string): BoardTemplate | undefined => BOARD_TEMPLATES.find((t) => t.id === id)
