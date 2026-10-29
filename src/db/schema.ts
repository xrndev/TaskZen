import { sql } from 'drizzle-orm'
import {
  boolean, check, doublePrecision, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

// Las propiedades de dominio usan snake_case para coincidir con los tipos de `@/types`.
// Los timestamps van en modo string (ISO) para poder serializarlos a componentes cliente.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })
// Better Auth trabaja con objetos Date, así que sus tablas usan el modo por defecto.
const tsDate = (name: string) => timestamp(name, { withTimezone: true })

/* ---------- Better Auth ---------- */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: tsDate('created_at').notNull().defaultNow(),
  updatedAt: tsDate('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: tsDate('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: tsDate('created_at').notNull().defaultNow(),
  updatedAt: tsDate('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (t) => [index('session_user_idx').on(t.userId)])

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: tsDate('access_token_expires_at'),
  refreshTokenExpiresAt: tsDate('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: tsDate('created_at').notNull().defaultNow(),
  updatedAt: tsDate('updated_at').notNull().defaultNow(),
}, (t) => [index('account_user_idx').on(t.userId)])

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: tsDate('expires_at').notNull(),
  createdAt: tsDate('created_at').notNull().defaultNow(),
  updatedAt: tsDate('updated_at').notNull().defaultNow(),
}, (t) => [index('verification_identifier_idx').on(t.identifier)])

export const passkey = pgTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credential_id').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull(),
  transports: text('transports'),
  createdAt: tsDate('created_at').defaultNow(),
  aaguid: text('aaguid'),
}, (t) => [index('passkey_user_idx').on(t.userId), index('passkey_credential_idx').on(t.credentialID)])

/* ---------- Dominio ---------- */
export const taskStatus = pgEnum('task_status', ['pending', 'in_progress', 'completed'])
export const teamRole = pgEnum('team_role', ['admin', 'product_owner', 'member'])

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  owner_id: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  is_personal: boolean('is_personal').notNull().default(false),
  created_at: ts('created_at').notNull().defaultNow(),
})

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  team_id: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: teamRole('role').notNull().default('member'),
  joined_at: ts('joined_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('team_members_team_user_uq').on(t.team_id, t.user_id),
  index('team_members_user_idx').on(t.user_id),
])

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  team_id: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  assigned_to: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatus('status').notNull().default('pending'),
  // Orden fraccionario: arrastrar solo reescribe la tarea movida.
  position: doublePrecision('position').notNull().default(0),
  image_url: text('image_url'),
  due_date: ts('due_date'),
  created_at: ts('created_at').notNull().defaultNow(),
  updated_at: ts('updated_at').notNull().defaultNow(),
}, (t) => [index('tasks_board_idx').on(t.team_id, t.status, t.position)])

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  team_id: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3b82f6'),
  parent_id: uuid('parent_id').references((): AnyPgColumn => tags.id, { onDelete: 'cascade' }),
  created_at: ts('created_at').notNull().defaultNow(),
}, (t) => [index('tags_team_idx').on(t.team_id)])

export const taskTags = pgTable('task_tags', {
  task_id: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tag_id: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.task_id, t.tag_id] })])

export const comments = pgTable('task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parent_id: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
  created_at: ts('created_at').notNull().defaultNow(),
}, (t) => [index('comments_task_idx').on(t.task_id)])

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  task_id: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  comment_id: uuid('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  file_name: text('file_name').notNull(),
  file_path: text('file_path').notNull(), // clave relativa dentro de UPLOADS_DIR
  file_type: text('file_type').notNull(),
  size: integer('size').notNull(),
  created_at: ts('created_at').notNull().defaultNow(),
}, (t) => [index('attachments_task_idx').on(t.task_id), index('attachments_comment_idx').on(t.comment_id)])

export const teamInvites = pgTable('team_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  team_id: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  // Se guarda el hash SHA-256: una copia de la base de datos no revela enlaces utilizables.
  token_hash: text('token_hash').notNull().unique(),
  role: teamRole('role').notNull().default('member'),
  created_by: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expires_at: ts('expires_at').notNull(),
  revoked_at: ts('revoked_at'),
  created_at: ts('created_at').notNull().defaultNow(),
}, (t) => [index('team_invites_team_idx').on(t.team_id)])

/* ---------- Planes ---------- */
// Una fila por dueño (una persona o un equipo, nunca los dos). Se conserva al caducar: así la prueba gratuita
// solo se puede usar una vez por dueño. `ends_at` es el fin de la prueba o del periodo pagado (null = sin caducidad).
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  team_id: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull(),
  status: text('status').notNull().default('active'), // 'trialing' | 'active' | 'canceled'
  ends_at: ts('ends_at'),
  provider: text('provider').notNull().default('manual'), // 'trial' | 'manual' | (futuro) el proveedor de pagos
  provider_ref: text('provider_ref'),
  created_at: ts('created_at').notNull().defaultNow(),
  updated_at: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  check('subscriptions_one_owner', sql`num_nonnulls(${t.user_id}, ${t.team_id}) = 1`),
  uniqueIndex('subscriptions_user_uq').on(t.user_id).where(sql`${t.user_id} is not null`),
  uniqueIndex('subscriptions_team_uq').on(t.team_id).where(sql`${t.team_id} is not null`),
])

/* ---------- Notificaciones push y recordatorios ---------- */
export const notificationEndpoints = pgTable('notification_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('webpush'), // 'webpush' (navegador) o 'fcm' (app nativa Android); `endpoint` guarda la URL o el token
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh'), // solo Web Push
  auth: text('auth'), // solo Web Push
  user_agent: text('user_agent'),
  created_at: ts('created_at').notNull().defaultNow(),
  last_ok_at: ts('last_ok_at'),
  disabled_at: ts('disabled_at'),
}, (t) => [index('notification_endpoints_user_idx').on(t.user_id)])

export const notificationPrefs = pgTable('notification_prefs', {
  user_id: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false), // opt-in explícito
  due_soon: boolean('due_soon').notNull().default(true),
  assigned: boolean('assigned').notNull().default(true),
  offsets_minutes: integer('offsets_minutes').array().notNull().default(sql`'{1440,60}'::integer[]`),
  quiet_start: text('quiet_start'), // 'HH:MM' en la zona horaria del usuario
  quiet_end: text('quiet_end'),
  timezone: text('timezone').notNull().default('Europe/Madrid'),
  updated_at: ts('updated_at').notNull().defaultNow(),
})

// Un aviso por (tarea, persona, antelación, fecha límite). Reclamar la fila ANTES de enviar garantiza
// "como mucho una vez" aunque dos llamadas coincidan; si la fecha cambia, vuelve a avisar.
export const reminderLog = pgTable('reminder_log', {
  task_id: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  offset_minutes: integer('offset_minutes').notNull(),
  due_at: ts('due_at').notNull(),
  sent_at: ts('sent_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.task_id, t.user_id, t.offset_minutes, t.due_at] })])
