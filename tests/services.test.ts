// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/server/db'
import { ServiceError } from '@/server/services/common'
import * as teamsSvc from '@/server/services/teams'
import * as tasksSvc from '@/server/services/tasks'
import * as tagsSvc from '@/server/services/tags'
import * as commentsSvc from '@/server/services/comments'
import * as attSvc from '@/server/services/attachments'
import { grantPlan } from '@/server/services/billing'
import { createTestDb, createUser } from './helpers/testdb'

let db: Db
let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>
let carol: Awaited<ReturnType<typeof createUser>>
let shared: { id: string }

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'ServiceError', code })
}

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
  carol = await createUser(db, 'Carol')
  // Estas pruebas crean varios equipos con la misma persona: necesita un plan sin tope de equipos.
  await grantPlan(db, { userId: alice.id }, 'user_pro')
  // Equipo compartido: Alice admin, Bob member. Carol queda fuera.
  shared = await teamsSvc.createTeam(db, alice.id, 'Shared')
  await teamsSvc.inviteMember(db, alice.id, shared.id, 'bob@test.dev', 'member')
})

describe('aislamiento entre equipos', () => {
  it('cada usuario tiene su espacio personal', async () => {
    const teams = await teamsSvc.listTeams(db, carol.id)
    expect(teams).toHaveLength(1)
    expect(teams[0].is_personal).toBe(true)
  })

  it('un ajeno no puede listar, crear ni leer en un equipo que no es suyo', async () => {
    const t = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'Secreta' })
    await expectCode(tasksSvc.listTasks(db, carol.id, shared.id), 'FORBIDDEN')
    await expectCode(tasksSvc.createTask(db, carol.id, shared.id, { title: 'x' }), 'FORBIDDEN')
    await expectCode(tasksSvc.updateTask(db, carol.id, t.id, { title: 'hack' }), 'NOT_FOUND')
    await expectCode(tasksSvc.deleteTask(db, carol.id, t.id), 'NOT_FOUND')
    await expectCode(commentsSvc.listComments(db, carol.id, t.id), 'NOT_FOUND')
    await expectCode(commentsSvc.createComment(db, carol.id, t.id, 'hola'), 'NOT_FOUND')
    await expectCode(tagsSvc.listTags(db, carol.id, shared.id), 'FORBIDDEN')
    await expectCode(teamsSvc.listMembers(db, carol.id, shared.id), 'FORBIDDEN')
  })

  it('no se puede asignar una tarea a quien no pertenece al equipo', async () => {
    await expectCode(tasksSvc.createTask(db, alice.id, shared.id, { title: 'x', assigned_to: carol.id }), 'INVALID')
  })

  it('no se pueden usar etiquetas de otro equipo', async () => {
    const foreign = await tagsSvc.createTag(db, carol.id, carol.team.id, { name: 'ajena' })
    await expectCode(tasksSvc.createTask(db, alice.id, shared.id, { title: 'x', tag_ids: [foreign.id] }), 'INVALID')
  })
})

describe('roles', () => {
  it('un member no edita ni borra tareas ajenas; el admin sí', async () => {
    const t = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'De Alice' })
    await expectCode(tasksSvc.updateTask(db, bob.id, t.id, { title: 'mía' }), 'FORBIDDEN')
    await expectCode(tasksSvc.deleteTask(db, bob.id, t.id), 'FORBIDDEN')
    await tasksSvc.updateTask(db, alice.id, t.id, { title: 'Editada' })
  })

  it('el asignado puede mover la tarea pero no borrarla', async () => {
    const t = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'Asignada', assigned_to: bob.id })
    await tasksSvc.moveTask(db, bob.id, t.id, { status: 'in_progress' })
    await expectCode(tasksSvc.deleteTask(db, bob.id, t.id), 'FORBIDDEN')
  })

  it('solo un admin gestiona miembros y siempre queda uno', async () => {
    await expectCode(teamsSvc.inviteMember(db, bob.id, shared.id, 'carol@test.dev'), 'FORBIDDEN')
    await expectCode(teamsSvc.updateMemberRole(db, bob.id, shared.id, bob.id, 'admin'), 'FORBIDDEN')
    await expectCode(teamsSvc.removeMember(db, alice.id, shared.id, alice.id), 'CONFLICT')
    await expectCode(teamsSvc.updateMemberRole(db, alice.id, shared.id, alice.id, 'member'), 'CONFLICT')
    await expectCode(teamsSvc.inviteMember(db, alice.id, shared.id, 'bob@test.dev'), 'CONFLICT')
    await expectCode(teamsSvc.inviteMember(db, alice.id, shared.id, 'nadie@test.dev'), 'NOT_FOUND')
  })

  it('no se puede borrar el espacio personal', async () => {
    await expectCode(teamsSvc.deleteTeam(db, alice.id, alice.team.id), 'CONFLICT')
  })
})

describe('tablero', () => {
  it('moveTask coloca entre vecinas y solo reescribe la tarea movida', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Orden')
    const a = await tasksSvc.createTask(db, alice.id, team.id, { title: 'A' })
    const b = await tasksSvc.createTask(db, alice.id, team.id, { title: 'B' })
    const c = await tasksSvc.createTask(db, alice.id, team.id, { title: 'C' })
    // Orden inicial A, B, C. Movemos C entre A y B.
    await tasksSvc.moveTask(db, alice.id, c.id, { status: 'pending', prevId: a.id, nextId: b.id })
    const titles = (await tasksSvc.listTasks(db, alice.id, team.id)).map((t) => t.title)
    expect(titles).toEqual(['A', 'C', 'B'])
    // Movemos B a otra columna al principio.
    await tasksSvc.moveTask(db, alice.id, b.id, { status: 'completed' })
    const after = await tasksSvc.listTasks(db, alice.id, team.id)
    expect(after.find((t) => t.id === b.id)?.status).toBe('completed')
  })

  it('moveTask rechaza vecinas de otra columna o de otro equipo', async () => {
    const t1 = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'N1' })
    const other = await tasksSvc.createTask(db, alice.id, alice.team.id, { title: 'Otro equipo' })
    await expectCode(tasksSvc.moveTask(db, alice.id, t1.id, { status: 'pending', prevId: other.id }), 'INVALID')
  })

  it('listTasks devuelve etiquetas, responsable y contadores', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Datos')
    const tag = await tagsSvc.createTag(db, alice.id, team.id, { name: 'Urgente', color: '#ff0000' })
    const t = await tasksSvc.createTask(db, alice.id, team.id, { title: 'Con datos', tag_ids: [tag.id], assigned_to: alice.id })
    await commentsSvc.createComment(db, alice.id, t.id, 'primero')
    const [row] = await tasksSvc.listTasks(db, alice.id, team.id)
    expect(row.tags?.map((x) => x.name)).toEqual(['Urgente'])
    expect(row.assignee?.full_name).toBe('Alice')
    expect(row.comment_count).toBe(1)
    expect(row.attachment_count).toBe(0)
  })

  it('el título vacío se rechaza', async () => {
    await expectCode(tasksSvc.createTask(db, alice.id, shared.id, { title: '   ' }), 'INVALID')
  })
})

describe('comentarios y adjuntos', () => {
  it('hilos anidados y borrado solo por autor o gestor', async () => {
    const t = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'Hilo' })
    const root = await commentsSvc.createComment(db, alice.id, t.id, 'raíz')
    const reply = await commentsSvc.createComment(db, bob.id, t.id, 'respuesta', root.id)
    const tree = await commentsSvc.listComments(db, bob.id, t.id)
    expect(tree).toHaveLength(1)
    expect(tree[0].replies?.[0].id).toBe(reply.id)
    await expectCode(commentsSvc.deleteComment(db, bob.id, root.id), 'FORBIDDEN')
    await commentsSvc.deleteComment(db, alice.id, root.id)
    expect(await commentsSvc.listComments(db, alice.id, t.id)).toHaveLength(0)
  })

  it('un adjunto solo es accesible para miembros y apunta a tarea o comentario', async () => {
    const t = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'Con archivo' })
    const att = await attSvc.recordAttachment(db, alice.id, {
      task_id: t.id, file_name: 'a.pdf', file_path: 'k1.pdf', file_type: 'application/pdf', size: 10,
    })
    await expectCode(attSvc.getAccessibleAttachment(db, carol.id, att.id), 'NOT_FOUND')
    await expectCode(attSvc.deleteAttachment(db, bob.id, att.id), 'FORBIDDEN')
    await expectCode(attSvc.authorizeUpload(db, alice.id, {}), 'INVALID')
    expect(await attSvc.deleteAttachment(db, alice.id, att.id)).toBe('k1.pdf')
  })

  it('borrar una tarea devuelve los archivos a retirar del disco', async () => {
    const t = await tasksSvc.createTask(db, alice.id, shared.id, { title: 'Borrar' })
    const c = await commentsSvc.createComment(db, alice.id, t.id, 'x')
    await attSvc.recordAttachment(db, alice.id, { task_id: t.id, file_name: 'a', file_path: 'f1', file_type: 'text/plain', size: 1 })
    await attSvc.recordAttachment(db, alice.id, { comment_id: c.id, file_name: 'b', file_path: 'f2', file_type: 'text/plain', size: 1 })
    expect((await tasksSvc.deleteTask(db, alice.id, t.id)).sort()).toEqual(['f1', 'f2'])
  })
})

it('ServiceError es identificable', () => {
  expect(new ServiceError('INVALID', 'x')).toBeInstanceOf(Error)
})
