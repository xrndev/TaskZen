/**
 * El servidor devuelve fechas de Postgres ("2026-10-22 10:00:00+00"). V8 (la web) las entiende; Hermes no,
 * así que se normalizan a ISO 8601 antes de crear el `Date`.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  let s = value.trim().replace(' ', 'T')
  s = s.replace(/([+-]\d{2})$/, '$1:00') // "+00" → "+00:00"
  s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2') // "+0000" → "+00:00"
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export const toMs = (value: string | null | undefined) => parseDate(value)?.getTime() ?? NaN

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const two = (n: number) => String(n).padStart(2, '0')

export const fmtTime = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`
/** "22 oct, 10:00" */
export const fmtShort = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}, ${fmtTime(d)}`
/** "22/10, 10:00" (comentarios) */
export const fmtComment = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}, ${fmtTime(d)}`
/** "jueves, 22 de octubre de 2026, 10:00" */
export const fmtLong = (d: Date) => `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]} de ${d.getFullYear()}, ${fmtTime(d)}`
/** "jueves, 22 de octubre" */
export const fmtDay = (d: Date) => `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`
/** "octubre 2026" */
export const fmtMonth = (d: Date) => `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
export const fmtDate = (d: Date) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`
