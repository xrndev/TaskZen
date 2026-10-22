// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '@/server/db'
import { createTestDb, createUser } from './helpers/testdb'

const state = vi.hoisted(() => ({ userId: null as string | null, db: null as unknown }))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => (state.userId ? { user: { id: state.userId } } : null) } },
}))
vi.mock('@/server/db', () => ({ get db() { return state.db } }))
vi.mock('@/server/push/assigned', () => ({ notifyAssignedInBackground: vi.fn() }))

import * as notifDevices from '@/app/api/v1/notifications/devices/route'
import * as notifPrefs from '@/app/api/v1/notifications/prefs/route'
import * as notifState from '@/app/api/v1/notifications/route'
import * as attachment from '@/app/api/v1/attachments/[id]/route'
import * as attachments from '@/app/api/v1/attachments/route'
import * as comment from '@/app/api/v1/comments/[id]/route'
import * as invite from '@/app/api/v1/invites/[id]/route'
import { notifyAssignedInBackground } from '@/server/push/assigned'
import * as tag from '@/app/api/v1/tags/[id]/route'
import * as taskAttachments from '@/app/api/v1/tasks/[id]/attachments/route'
import * as teamInvites from '@/app/api/v1/teams/[id]/invites/route'
import * as teamMember from '@/app/api/v1/teams/[id]/members/[userId]/route'
import * as teamMembers from '@/app/api/v1/teams/[id]/members/route'
import * as teamTags from '@/app/api/v1/teams/[id]/tags/route'
import * as team from '@/app/api/v1/teams/[id]/route'
import * as me from '@/app/api/v1/me/route'
import * as taskComments from '@/app/api/v1/tasks/[id]/comments/route'
import * as move from '@/app/api/v1/tasks/[id]/move/route'
import * as task from '@/app/api/v1/tasks/[id]/route'
import * as teamTasks from '@/app/api/v1/teams/[id]/tasks/route'
import * as teams from '@/app/api/v1/teams/route'

const req = (method: string, body?: unknown) =>
  new Request('http://test.local/api/v1/x', { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
const ctx = (id: string, extra: Record<string, string> = {}) => ({ params: Promise.resolve({ id, ...extra }) })
const call = async (res: Response | Promise<Response>) => {
  const r = await res
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: r.status, body: (await r.json()) as { data?: any; error?: string; code?: string } }
}

process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), 'taskzen-uploads-'))

let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>

beforeAll(async () => {
  const db: Db = await createTestDb()
  state.db = db
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
})
beforeEach(() => { state.userId = alice.id })

describe('API v1', () => {
  it('responde 401 sin sesión', async () => {
    state.userId = null
    expect((await call(teams.GET(req('GET')))).status).toBe(401)
    expect((await call(teamTasks.GET(req('GET'), ctx(alice.team.id)))).status).toBe(401)
  })

  it('devuelve el perfil y los equipos de quien consulta', async () => {
    expect((await call(me.GET(req('GET')))).body.data).toMatchObject({ id: alice.id, full_name: 'Alice' })
    const list = (await call(teams.GET(req('GET')))).body.data as Array<{ id: string }>
    expect(list.map((t) => t.id)).toContain(alice.team.id)
  })

  it('crea un equipo y valida el cuerpo', async () => {
    const ok = await call(teams.POST(req('POST', { name: '  Equipo móvil ' })))
    expect(ok.status).toBe(201)
    expect(ok.body.data.name).toBe('Equipo móvil')
    expect((await call(teams.POST(req('POST', { name: '  ' })))).status).toBe(400)
    expect((await call(teams.POST(req('POST', '{no es json')))).status).toBe(400)
  })

  it('crea, lista, mueve, edita y borra una tarea', async () => {
    const created = await call(teamTasks.POST(req('POST', { title: 'Preparar release' }), ctx(alice.team.id)))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    const list = await call(teamTasks.GET(req('GET'), ctx(alice.team.id)))
    expect(list.body.data.map((t: { id: string }) => t.id)).toContain(id)

    expect((await call(move.POST(req('POST', { status: 'in_progress' }), ctx(id)))).status).toBe(200)
    expect((await call(task.PATCH(req('PATCH', { title: 'Release 1.0' }), ctx(id)))).status).toBe(200)
    const after = await call(teamTasks.GET(req('GET'), ctx(alice.team.id)))
    expect(after.body.data.find((t: { id: string }) => t.id === id)).toMatchObject({ title: 'Release 1.0', status: 'in_progress' })

    expect((await call(task.DELETE(req('DELETE'), ctx(id)))).status).toBe(200)
  })

  it('rechaza datos no válidos con 400 y estados desconocidos', async () => {
    expect((await call(teamTasks.POST(req('POST', { title: '' }), ctx(alice.team.id)))).status).toBe(400)
    const id = (await call(teamTasks.POST(req('POST', { title: 'x' }), ctx(alice.team.id)))).body.data.id
    expect((await call(move.POST(req('POST', { status: 'otro' }), ctx(id)))).status).toBe(400)
  })

  it('no deja entrar a un equipo ajeno y trata un id mal formado como inexistente', async () => {
    state.userId = bob.id
    expect((await call(teamTasks.GET(req('GET'), ctx(alice.team.id)))).status).toBe(403)
    expect((await call(teamTasks.POST(req('POST', { title: 'intruso' }), ctx(alice.team.id)))).status).toBe(403)
    expect((await call(task.DELETE(req('DELETE'), ctx('no-es-uuid')))).status).toBe(404)
  })

  it('comenta una tarea y borra el comentario', async () => {
    const id = (await call(teamTasks.POST(req('POST', { title: 'Con comentarios' }), ctx(alice.team.id)))).body.data.id
    const created = await call(taskComments.POST(req('POST', { content: 'Hola' }), ctx(id)))
    expect(created.status).toBe(201)
    const list = await call(taskComments.GET(req('GET'), ctx(id)))
    expect(list.body.data).toHaveLength(1)
    state.userId = bob.id
    // El servicio no distingue "no existe" de "no eres miembro".
    expect((await call(taskComments.GET(req('GET'), ctx(id)))).status).toBe(404)
    state.userId = alice.id
    expect((await call(comment.DELETE(req('DELETE'), ctx(created.body.data.id)))).status).toBe(200)
  })

  it('dispara el aviso en segundo plano solo si la tarea tiene responsable', async () => {
    vi.mocked(notifyAssignedInBackground).mockClear()
    const created = await call(teamTasks.POST(req('POST', { title: 'Asignada', assigned_to: alice.id }), ctx(alice.team.id)))
    expect(created.status).toBe(201)
    expect(notifyAssignedInBackground).toHaveBeenCalledWith(alice.id, created.body.data.id)
    vi.mocked(notifyAssignedInBackground).mockClear()
    await call(teamTasks.POST(req('POST', { title: 'Sin responsable' }), ctx(alice.team.id)))
    expect(notifyAssignedInBackground).not.toHaveBeenCalled()
  })

  it('gestiona etiquetas: crear, renombrar y borrar', async () => {
    const created = await call(teamTags.POST(req('POST', { name: 'Urgente', color: '#ef4444' }), ctx(alice.team.id)))
    expect(created.status).toBe(201)
    const id = created.body.data.id as string
    expect((await call(teamTags.POST(req('POST', { name: 'x', color: 'rojo' }), ctx(alice.team.id)))).status).toBe(400)
    expect((await call(tag.PATCH(req('PATCH', { name: 'Muy urgente' }), ctx(id)))).status).toBe(200)
    const list = await call(teamTags.GET(req('GET'), ctx(alice.team.id)))
    expect(list.body.data.find((t: { id: string }) => t.id === id).name).toBe('Muy urgente')
    expect((await call(tag.DELETE(req('DELETE'), ctx(id)))).status).toBe(200)
  })

  it('crea un equipo, invita por enlace, cambia roles y lo borra', async () => {
    const created = await call(teams.POST(req('POST', { name: 'Equipo API' })))
    const teamId = created.body.data.id as string

    const link = await call(teamInvites.POST(req('POST', { role: 'member' }), ctx(teamId)))
    expect(link.status).toBe(201)
    expect(link.body.data.token).toBeTruthy()
    expect((await call(teamInvites.GET(req('GET'), ctx(teamId)))).body.data).toHaveLength(1)
    expect((await call(invite.DELETE(req('DELETE'), ctx(link.body.data.invite.id)))).status).toBe(200)
    expect((await call(teamInvites.GET(req('GET'), ctx(teamId)))).body.data).toHaveLength(0)

    expect((await call(teamMembers.POST(req('POST', { email: 'bob@test.dev', role: 'member' }), ctx(teamId)))).status).toBe(201)
    expect((await call(teamMembers.POST(req('POST', { email: 'bob@test.dev' }), ctx(teamId)))).status).toBe(409)
    expect((await call(teamMember.PATCH(req('PATCH', { role: 'product_owner' }), ctx(teamId, { userId: bob.id })))).status).toBe(200)
    const members = await call(teamMembers.GET(req('GET'), ctx(teamId)))
    expect(members.body.data.find((m: { user_id: string }) => m.user_id === bob.id).role).toBe('product_owner')

    state.userId = bob.id
    expect((await call(team.DELETE(req('DELETE'), ctx(teamId)))).status).toBe(403)
    state.userId = alice.id
    expect((await call(teamMember.DELETE(req('DELETE'), ctx(teamId, { userId: bob.id })))).status).toBe(200)
    expect((await call(team.DELETE(req('DELETE'), ctx(teamId)))).status).toBe(200)
  })

  it('edita el perfil con validación', async () => {
    expect((await call(me.PATCH(req('PATCH', { full_name: 'Alicia' })))).body.data.full_name).toBe('Alicia')
    expect((await call(me.PATCH(req('PATCH', { full_name: '  ' })))).status).toBe(400)
    expect((await call(me.PATCH(req('PATCH', { avatar_url: 'http://inseguro.test/a.png' })))).status).toBe(400)
  })

  it('sube, lista, descarga el registro y borra un adjunto', async () => {
    const taskId = (await call(teamTasks.POST(req('POST', { title: 'Con archivo' }), ctx(alice.team.id)))).body.data.id as string
    const form = new FormData()
    form.set('file', new File(['hola mundo'], 'notas.txt', { type: 'text/plain' }))
    form.set('taskId', taskId)
    const up = await call(attachments.POST(new Request('http://test.local/api/v1/attachments', { method: 'POST', body: form })))
    expect(up.status).toBe(201)
    expect(up.body.data).toMatchObject({ file_name: 'notas.txt', task_id: taskId })

    expect((await call(taskAttachments.GET(req('GET'), ctx(taskId)))).body.data).toHaveLength(1)

    state.userId = bob.id
    expect((await call(attachment.DELETE(req('DELETE'), ctx(up.body.data.id)))).status).toBeGreaterThanOrEqual(403)
    state.userId = alice.id
    expect((await call(attachment.DELETE(req('DELETE'), ctx(up.body.data.id)))).status).toBe(200)
    expect((await call(taskAttachments.GET(req('GET'), ctx(taskId)))).body.data).toHaveLength(0)

    const empty = new FormData()
    expect((await call(attachments.POST(new Request('http://test.local/x', { method: 'POST', body: empty })))).status).toBe(400)
  })

  it('registra y quita el token de FCM de la app, y enciende los avisos la primera vez', async () => {
    const TOKEN = 'fcm-token-de-prueba-'.repeat(6)
    const key = process.env.FCM_SERVICE_ACCOUNT_B64
    delete process.env.FCM_SERVICE_ACCOUNT_B64
    // Sin cuenta de servicio en el servidor, la app no puede registrarse.
    expect((await call(notifDevices.POST(req('POST', { token: TOKEN, timezone: 'Europe/Madrid' })))).status).toBe(400)
    process.env.FCM_SERVICE_ACCOUNT_B64 = Buffer.from(JSON.stringify({ project_id: 'p', client_email: 'e@x.iam', private_key: 'k' })).toString('base64')

    expect((await call(notifState.GET(req('GET')))).body.data).toMatchObject({ fcm: true, devices: 0, prefs: { enabled: false } })
    expect((await call(notifDevices.POST(req('POST', { token: 'corto', timezone: 'Europe/Madrid' })))).status).toBe(400)
    const reg = await call(notifDevices.POST(req('POST', { token: TOKEN, userAgent: 'TaskZen Android', timezone: 'Europe/Madrid' })))
    expect(reg.status).toBe(201)
    expect(reg.body.data).toEqual({ devices: 1 })
    expect((await call(notifState.GET(req('GET')))).body.data).toMatchObject({ devices: 1, prefs: { enabled: true, timezone: 'Europe/Madrid' } })

    // Registrar el mismo token otra vez no duplica el dispositivo.
    expect((await call(notifDevices.POST(req('POST', { token: TOKEN, timezone: 'Europe/Madrid' })))).body.data).toEqual({ devices: 1 })

    const prefs = { enabled: true, due_soon: true, assigned: false, offsets_minutes: [60], quiet_start: null, quiet_end: null, timezone: 'Europe/Madrid' }
    expect((await call(notifPrefs.PUT(req('PUT', prefs)))).body.data).toMatchObject({ assigned: false, offsets_minutes: [60] })
    expect((await call(notifPrefs.PUT(req('PUT', { ...prefs, offsets_minutes: [7] })))).status).toBe(400)

    // Al quitar el último dispositivo se apagan los avisos.
    expect((await call(notifDevices.DELETE(req('DELETE', { endpoint: TOKEN })))).body.data).toEqual({ devices: 0 })
    expect((await call(notifState.GET(req('GET')))).body.data.prefs.enabled).toBe(false)

    if (key) process.env.FCM_SERVICE_ACCOUNT_B64 = key
    else delete process.env.FCM_SERVICE_ACCOUNT_B64
  })
})
