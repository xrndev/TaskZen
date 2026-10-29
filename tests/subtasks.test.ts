// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/server/db'
import { grantPlan } from '@/server/services/billing'
import * as subSvc from '@/server/services/subtasks'
import { createTask, deleteTask, listTasks, updateTask } from '@/server/services/tasks'
import { createTeam, inviteMember } from '@/server/services/teams'
import { createTestDb, createUser } from './helpers/testdb'

let db: Db
let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>
let carol: Awaited<ReturnType<typeof createUser>>
let team: { id: string }
let taskId: string

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'ServiceError', code })
}

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
  carol = await createUser(db, 'Carol')
  await grantPlan(db, { userId: alice.id }, 'user_plus')
  team = await createTeam(db, alice.id, 'Equipo')
  await inviteMember(db, alice.id, team.id, 'bob@test.dev', 'member')
  taskId = (await createTask(db, alice.id, team.id, { title: 'Entregar informe' })).id
})

describe('subtareas', () => {
  it('crea, marca, edita y borra, y el tablero cuenta total y hechas', async () => {
    const a = await subSvc.createSubtask(db, alice.id, taskId, '  Redactar  ')
    const b = await subSvc.createSubtask(db, alice.id, taskId, 'Revisar')
    expect(a.title).toBe('Redactar')
    expect(b.position).toBeGreaterThan(a.position)

    await subSvc.updateSubtask(db, alice.id, a.id, { done: true })
    let [t] = await listTasks(db, alice.id, team.id)
    expect([t.subtask_total, t.subtask_done]).toEqual([2, 1])

    await subSvc.updateSubtask(db, alice.id, b.id, { title: 'Revisar con Bob' })
    expect((await subSvc.listSubtasks(db, alice.id, taskId)).map((s) => s.title)).toEqual(['Redactar', 'Revisar con Bob'])

    await subSvc.deleteSubtask(db, alice.id, b.id)
    ;[t] = await listTasks(db, alice.id, team.id)
    expect([t.subtask_total, t.subtask_done]).toEqual([1, 1])
  })

  it('valida el texto', async () => {
    await expectCode(subSvc.createSubtask(db, alice.id, taskId, '   '), 'INVALID')
    const [s] = await subSvc.listSubtasks(db, alice.id, taskId)
    await expectCode(subSvc.updateSubtask(db, alice.id, s.id, { title: ' ' }), 'INVALID')
  })

  it('respeta los permisos de la tarea: un miembro ajeno ve pero no edita, y quien tiene la tarea asignada sí', async () => {
    const [s] = await subSvc.listSubtasks(db, alice.id, taskId)
    await expect(subSvc.listSubtasks(db, bob.id, taskId)).resolves.toHaveLength(1) // ve la lista
    await expectCode(subSvc.createSubtask(db, bob.id, taskId, 'Intruso'), 'FORBIDDEN')
    await expectCode(subSvc.updateSubtask(db, bob.id, s.id, { done: false }), 'FORBIDDEN')
    await expectCode(subSvc.deleteSubtask(db, bob.id, s.id), 'FORBIDDEN')

    await updateTask(db, alice.id, taskId, { assigned_to: bob.id })
    await expect(subSvc.updateSubtask(db, bob.id, s.id, { done: false })).resolves.toBeUndefined()
  })

  it('no revela tareas ni subtareas de equipos ajenos', async () => {
    const [s] = await subSvc.listSubtasks(db, alice.id, taskId)
    await expectCode(subSvc.listSubtasks(db, carol.id, taskId), 'NOT_FOUND')
    await expectCode(subSvc.createSubtask(db, carol.id, taskId, 'x'), 'NOT_FOUND')
    await expectCode(subSvc.updateSubtask(db, carol.id, s.id, { done: true }), 'NOT_FOUND')
    await expectCode(subSvc.deleteSubtask(db, carol.id, '00000000-0000-4000-8000-000000000000'), 'NOT_FOUND')
  })

  it('aplica el tope por tarea', async () => {
    const t = await createTask(db, alice.id, team.id, { title: 'Con muchos pasos' })
    for (let i = 0; i < subSvc.MAX_SUBTASKS; i++) await subSvc.createSubtask(db, alice.id, t.id, `Paso ${i + 1}`)
    await expectCode(subSvc.createSubtask(db, alice.id, t.id, 'Uno de más'), 'INVALID')
  })

  it('se borran junto con la tarea', async () => {
    await deleteTask(db, alice.id, taskId)
    await expectCode(subSvc.listSubtasks(db, alice.id, taskId), 'NOT_FOUND')
  })
})
