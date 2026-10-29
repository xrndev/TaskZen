// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { taskTags, tasks } from '@/db/schema'
import { BOARD_TEMPLATES, templateById } from '@/lib/templates'
import type { Db } from '@/server/db'
import { createTag, listTags } from '@/server/services/tags'
import { applyTemplate } from '@/server/services/templates'
import { grantPlan } from '@/server/services/billing'
import { listTasks } from '@/server/services/tasks'
import { createTeam, inviteMember } from '@/server/services/teams'
import { createTestDb, createUser } from './helpers/testdb'

let db: Db
let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>
let carol: Awaited<ReturnType<typeof createUser>>

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'ServiceError', code })
}

beforeAll(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
  carol = await createUser(db, 'Carol')
})

describe('plantillas de tablero', () => {
  it('el catálogo es coherente: cada tarea usa una etiqueta de su plantilla', () => {
    for (const tpl of BOARD_TEMPLATES) {
      const names = tpl.tags.map((t) => t.name)
      for (const t of tpl.tasks) if ('tag' in t) expect(names).toContain(t.tag)
      expect(tpl.tasks.length).toBeGreaterThan(0)
    }
    expect(templateById('no-existe')).toBeUndefined()
  })

  it('rellena un tablero vacío con etiquetas, tareas, estados y fechas relativas a hoy', async () => {
    const now = new Date('2026-01-10T12:00:00Z')
    const res = await applyTemplate(db, alice.id, alice.team.id, 'sprint', now)
    expect(res.tasks).toBe(templateById('sprint')!.tasks.length)

    const board = await listTasks(db, alice.id, alice.team.id)
    expect(board).toHaveLength(res.tasks)
    expect(new Set(board.map((t) => t.status))).toEqual(new Set(['pending', 'in_progress', 'completed']))
    expect(board.every((t) => (t.tags?.length ?? 0) === 1)).toBe(true)

    const corregir = board.find((t) => t.title.startsWith('Corregir'))!
    expect(new Date(corregir.due_date!).toISOString()).toBe('2026-01-12T12:00:00.000Z')
    expect((await listTags(db, alice.id, alice.team.id)).map((t) => t.name).sort()).toEqual(['Error', 'Funcionalidad', 'Mejora'])
  })

  it('no se aplica sobre un tablero con tareas, ni cambia nada si falla', async () => {
    await expectCode(applyTemplate(db, alice.id, alice.team.id, 'marketing'), 'CONFLICT')
    expect((await listTags(db, alice.id, alice.team.id)).map((t) => t.name)).not.toContain('Contenido')
  })

  it('reutiliza etiquetas existentes con el mismo nombre en vez de duplicarlas', async () => {
    await createTag(db, bob.id, bob.team.id, { name: 'trabajo', color: '#000000' })
    await applyTemplate(db, bob.id, bob.team.id, 'personal')
    const names = (await listTags(db, bob.id, bob.team.id)).map((t) => t.name.toLowerCase())
    expect(names.filter((n) => n === 'trabajo')).toHaveLength(1)
    const links = await db.select().from(taskTags)
    expect(links.length).toBeGreaterThan(0)
  })

  it('exige ser miembro del equipo, y un miembro raso sí puede aplicarla', async () => {
    await expectCode(applyTemplate(db, alice.id, carol.team.id, 'sprint'), 'FORBIDDEN') // equipo ajeno
    await expectCode(applyTemplate(db, carol.id, carol.team.id, 'no-existe'), 'NOT_FOUND')
    await grantPlan(db, { userId: carol.id }, 'user_plus')
    const team = await createTeam(db, carol.id, 'Equipo de Carol')
    await inviteMember(db, carol.id, team.id, 'alice@test.dev', 'member')
    // Un miembro raso puede crear tareas y etiquetas: la plantilla se aplica.
    await expect(applyTemplate(db, alice.id, team.id, 'personal')).resolves.toMatchObject({ tasks: 4 })
    expect(await db.select().from(tasks).where(eq(tasks.team_id, team.id))).toHaveLength(4)
  })
})
