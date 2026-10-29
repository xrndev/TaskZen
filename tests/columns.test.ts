// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/server/db'
import { grantPlan, revokePlan } from '@/server/services/billing'
import * as colSvc from '@/server/services/columns'
import { createTask, listTasks, moveTask } from '@/server/services/tasks'
import { createTeam, inviteMember } from '@/server/services/teams'
import { createTestDb, createUser } from './helpers/testdb'

let db: Db
let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>
let carol: Awaited<ReturnType<typeof createUser>>
let team: { id: string }

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'ServiceError', code })
}

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
  carol = await createUser(db, 'Carol')
  await grantPlan(db, { userId: alice.id }, 'user_pro') // crea varios equipos
  await grantPlan(db, { userId: carol.id }, 'user_plus')
  team = await createTeam(db, alice.id, 'Equipo')
  await inviteMember(db, alice.id, team.id, 'bob@test.dev', 'member')
})

describe('columnas del tablero', () => {
  it('un equipo empieza con las tres de serie, sin nombre propio y en orden', async () => {
    const cols = await colSvc.listColumns(db, alice.id, team.id)
    expect(cols.map((c) => c.kind)).toEqual(['pending', 'in_progress', 'completed'])
    expect(cols.every((c) => c.name === null)).toBe(true)
    // Idempotente: pedirlas otra vez no duplica.
    expect(await colSvc.listColumns(db, alice.id, team.id)).toHaveLength(3)
  })

  it('las tareas nuevas caen en la primera columna y mover por estado va a la primera de ese tipo', async () => {
    const [first] = await colSvc.listColumns(db, alice.id, team.id)
    const t = await createTask(db, alice.id, team.id, { title: 'A' })
    expect(t.column_id).toBe(first.id)
    await moveTask(db, alice.id, t.id, { status: 'completed' }) // forma antigua (app Android)
    const [moved] = await listTasks(db, alice.id, team.id)
    expect(moved.status).toBe('completed')
    expect(moved.column_id).not.toBe(first.id)
  })

  it('solo administradores y product owners cambian las columnas; ver las ve cualquiera', async () => {
    await expect(colSvc.listColumns(db, bob.id, team.id)).resolves.toHaveLength(3)
    await expectCode(colSvc.createColumn(db, bob.id, team.id, { name: 'Revisión', kind: 'in_progress' }), 'FORBIDDEN')
    const [c] = await colSvc.listColumns(db, alice.id, team.id)
    await expectCode(colSvc.updateColumn(db, bob.id, c.id, { name: 'X' }), 'FORBIDDEN')
    await expectCode(colSvc.deleteColumn(db, bob.id, c.id), 'FORBIDDEN')
  })

  it('el plan gratuito del equipo no admite más de tres; Plus llega a seis y Pro a diez', async () => {
    const free = await createTeam(db, alice.id, 'Libre')
    await expectCode(colSvc.createColumn(db, alice.id, free.id, { name: 'Revisión', kind: 'in_progress' }), 'LIMIT')

    await grantPlan(db, { teamId: free.id }, 'team_plus')
    for (const n of ['Uno', 'Dos', 'Tres']) await colSvc.createColumn(db, alice.id, free.id, { name: n, kind: 'in_progress' })
    await expectCode(colSvc.createColumn(db, alice.id, free.id, { name: 'Siete', kind: 'in_progress' }), 'LIMIT')

    await grantPlan(db, { teamId: free.id }, 'team_pro')
    for (const n of ['Cuatro', 'Cinco', 'Seis', 'Siete']) await colSvc.createColumn(db, alice.id, free.id, { name: n, kind: 'in_progress' })
    await expectCode(colSvc.createColumn(db, alice.id, free.id, { name: 'Once', kind: 'in_progress' }), 'LIMIT')
    expect(await colSvc.listColumns(db, alice.id, free.id)).toHaveLength(10)

    // Bajar de plan no borra nada: solo impide añadir.
    await revokePlan(db, { teamId: free.id })
    expect(await colSvc.listColumns(db, alice.id, free.id)).toHaveLength(10)
    await expectCode(colSvc.createColumn(db, alice.id, free.id, { name: 'Otra', kind: 'pending' }), 'LIMIT')
  })

  it('el espacio personal usa el plan personal para el límite', async () => {
    // Carol tiene Personal Plus (6); Bob es gratuito (3).
    for (const n of ['Uno', 'Dos', 'Tres']) await colSvc.createColumn(db, carol.id, carol.team.id, { name: n, kind: 'in_progress' })
    await expectCode(colSvc.createColumn(db, carol.id, carol.team.id, { name: 'Cuatro', kind: 'in_progress' }), 'LIMIT')
    await expectCode(colSvc.createColumn(db, bob.id, bob.team.id, { name: 'Uno', kind: 'in_progress' }), 'LIMIT')
  })

  it('valida nombre y color, y permite renombrar y devolver una de serie a su nombre', async () => {
    const t = await createTeam(db, alice.id, 'Validaciones')
    await grantPlan(db, { teamId: t.id }, 'team_plus')
    await expectCode(colSvc.createColumn(db, alice.id, t.id, { name: '  ', kind: 'pending' }), 'INVALID')
    await expectCode(colSvc.createColumn(db, alice.id, t.id, { name: 'x'.repeat(41), kind: 'pending' }), 'INVALID')
    await expectCode(colSvc.createColumn(db, alice.id, t.id, { name: 'Ok', kind: 'pending', color: 'rojo' }), 'INVALID')

    const [serie] = await colSvc.listColumns(db, alice.id, t.id)
    await colSvc.updateColumn(db, alice.id, serie.id, { name: ' Por empezar ' })
    expect((await colSvc.listColumns(db, alice.id, t.id))[0].name).toBe('Por empezar')
    await colSvc.updateColumn(db, alice.id, serie.id, { name: null })
    expect((await colSvc.listColumns(db, alice.id, t.id))[0].name).toBeNull()

    const propia = await colSvc.createColumn(db, alice.id, t.id, { name: 'Bloqueada', kind: 'in_progress' })
    await colSvc.updateColumn(db, alice.id, propia.id, { name: null }) // vuelve al nombre de su tipo
    expect((await colSvc.listColumns(db, alice.id, t.id)).find((c) => c.id === propia.id)!.name).toBeNull()
  })

  it('cambiar el tipo de una columna cambia el estado de sus tareas', async () => {
    const t = await createTeam(db, alice.id, 'Tipos')
    await grantPlan(db, { teamId: t.id }, 'team_plus')
    const rev = await colSvc.createColumn(db, alice.id, t.id, { name: 'Revisión', kind: 'in_progress' })
    const task = await createTask(db, alice.id, t.id, { title: 'En revisión' })
    await moveTask(db, alice.id, task.id, { columnId: rev.id })
    expect((await listTasks(db, alice.id, t.id))[0].status).toBe('in_progress')
    await colSvc.updateColumn(db, alice.id, rev.id, { kind: 'completed' })
    expect((await listTasks(db, alice.id, t.id))[0].status).toBe('completed')
  })

  it('no mueve tareas a columnas de otro equipo', async () => {
    const other = await colSvc.listColumns(db, bob.id, bob.team.id)
    const task = await createTask(db, alice.id, team.id, { title: 'Mía' })
    await expectCode(moveTask(db, alice.id, task.id, { columnId: other[0].id }), 'INVALID')
    await expectCode(moveTask(db, alice.id, task.id, {}), 'INVALID')
  })

  it('al borrar una columna con tareas hay que elegir destino, y las tareas conservan su orden detrás de las que había', async () => {
    const t = await createTeam(db, alice.id, 'Borrado')
    await grantPlan(db, { teamId: t.id }, 'team_plus')
    const extra = await colSvc.createColumn(db, alice.id, t.id, { name: 'Extra', kind: 'in_progress' })
    const [pending] = await colSvc.listColumns(db, alice.id, t.id)
    const a = await createTask(db, alice.id, t.id, { title: 'Ya estaba' })
    const b = await createTask(db, alice.id, t.id, { title: 'Viene 1' })
    const c = await createTask(db, alice.id, t.id, { title: 'Viene 2' })
    await moveTask(db, alice.id, b.id, { columnId: extra.id })
    await moveTask(db, alice.id, c.id, { columnId: extra.id, prevId: b.id })

    await expectCode(colSvc.deleteColumn(db, alice.id, extra.id), 'INVALID')
    await expectCode(colSvc.deleteColumn(db, alice.id, extra.id, extra.id), 'INVALID')
    await colSvc.deleteColumn(db, alice.id, extra.id, pending.id)

    const board = (await listTasks(db, alice.id, t.id)).filter((x) => x.column_id === pending.id)
    expect(board.map((x) => x.title)).toEqual([a.title, 'Viene 1', 'Viene 2'])
    expect(board.every((x) => x.status === 'pending')).toBe(true)
    expect(await colSvc.listColumns(db, alice.id, t.id)).toHaveLength(3)
  })

  it('siempre queda al menos una columna', async () => {
    const t = await createTeam(db, alice.id, 'Mínimo')
    await grantPlan(db, { teamId: t.id }, 'team_plus')
    const cols = await colSvc.listColumns(db, alice.id, t.id)
    await colSvc.deleteColumn(db, alice.id, cols[0].id)
    await colSvc.deleteColumn(db, alice.id, cols[1].id)
    await expectCode(colSvc.deleteColumn(db, alice.id, cols[2].id), 'INVALID')
  })

  it('subir y bajar intercambia el sitio con la vecina y no sale por los extremos', async () => {
    const t = await createTeam(db, alice.id, 'Orden')
    const [a, b, c] = await colSvc.listColumns(db, alice.id, t.id)
    await colSvc.shiftColumn(db, alice.id, c.id, -1)
    expect((await colSvc.listColumns(db, alice.id, t.id)).map((x) => x.id)).toEqual([a.id, c.id, b.id])
    await colSvc.shiftColumn(db, alice.id, a.id, -1) // ya es la primera
    expect((await colSvc.listColumns(db, alice.id, t.id)).map((x) => x.id)).toEqual([a.id, c.id, b.id])
  })

  it('las tareas de un equipo sin columnas (datos antiguos) se colocan al listarlas', async () => {
    const legacy = await createUser(db, 'Legacy')
    // Inserta una tarea «a mano», sin columna, como las anteriores a esta función.
    const { tasks } = await import('@/db/schema')
    await db.insert(tasks).values({ team_id: legacy.team.id, user_id: legacy.id, title: 'Vieja', status: 'in_progress', position: 1000 })
    const cols = await colSvc.listColumns(db, legacy.id, legacy.team.id)
    const [t] = await listTasks(db, legacy.id, legacy.team.id)
    expect(t.column_id).toBe(cols.find((c) => c.kind === 'in_progress')!.id)
  })
})
