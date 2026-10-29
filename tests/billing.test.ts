// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { subscriptions } from '@/db/schema'
import {
  bestUserPlan, formatBytes, isActive, teamComparison, TEAM_PLANS, TRIAL_DAYS, userComparison, USER_PLANS,
} from '@/lib/plans'
import type { Db } from '@/server/db'
import * as attSvc from '@/server/services/attachments'
import * as billing from '@/server/services/billing'
import * as exportSvc from '@/server/services/export'
import * as invitesSvc from '@/server/services/invites'
import * as tasksSvc from '@/server/services/tasks'
import * as teamsSvc from '@/server/services/teams'
import { createTestDb, createUser } from './helpers/testdb'

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'ServiceError', code })
}

let db: Db
let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>

beforeEach(async () => {
  db = await createTestDb()
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
})

const MB = 1024 * 1024

describe('catálogo', () => {
  it('los límites crecen con cada plan', () => {
    const t = [TEAM_PLANS.team_free, TEAM_PLANS.team_plus, TEAM_PLANS.team_pro].map((p) => p.limits)
    expect(t[0].maxMembers).toBe(5)
    expect(t[1].maxMembers).toBe(15)
    expect(t[2].maxMembers).toBeNull()
    expect(t[0].storageBytes).toBeLessThan(t[1].storageBytes)
    expect(t[1].storageBytes).toBeLessThan(t[2].storageBytes)
    expect(USER_PLANS.user_free.limits.maxOwnedTeams).toBe(1)
    expect(USER_PLANS.user_pro.limits.maxOwnedTeams).toBeNull()
  })

  it('la tabla comparativa sale de los límites reales y no promete lo que no existe como incluido', () => {
    const rows = teamComparison()
    expect(rows.find((r) => r.label === 'Miembros por equipo')?.cells).toEqual(['5', '15', 'Ilimitados'])
    expect(rows.find((r) => r.label === 'Adjuntos compartidos')?.cells).toEqual(['100 MB', '5 GB', '50 GB'])
    // Lo no construido nunca figura como `true`.
    for (const label of ['Automatizaciones sencillas', 'Registro de auditoría', 'Historial completo de cada tarea']) {
      expect(rows.find((r) => r.label === label)?.cells.includes(true)).toBe(false)
    }
    for (const label of ['Sincronizar con tu calendario', 'Asistente de planificación', 'Notas privadas']) {
      expect(userComparison().find((r) => r.label === label)?.cells.includes(true)).toBe(false)
    }
  })

  it('isActive: una prueba caduca, un plan sin fecha no, una baja programada dura hasta su fecha', () => {
    const now = new Date('2026-06-01T00:00:00Z')
    expect(isActive({ plan: 'user_plus', status: 'trialing', ends_at: '2026-06-10T00:00:00Z' }, now)).toBe(true)
    expect(isActive({ plan: 'user_plus', status: 'trialing', ends_at: '2026-05-30T00:00:00Z' }, now)).toBe(false)
    expect(isActive({ plan: 'user_plus', status: 'active', ends_at: null }, now)).toBe(true)
    expect(isActive({ plan: 'user_plus', status: 'canceled', ends_at: null }, now)).toBe(false)
    expect(isActive({ plan: 'user_plus', status: 'canceled', ends_at: '2026-06-02T00:00:00Z' }, now)).toBe(true)
  })

  it('bestUserPlan y formatBytes', () => {
    expect(bestUserPlan('user_free', 'user_plus')).toBe('user_plus')
    expect(bestUserPlan('user_pro', 'user_plus')).toBe('user_pro')
    expect(formatBytes(100 * MB)).toBe('100 MB')
    expect(formatBytes(5 * 1024 * MB)).toBe('5 GB')
  })
})

describe('equipos propios', () => {
  it('el plan gratuito permite un equipo, Plus cinco y Pro ilimitados', async () => {
    await teamsSvc.createTeam(db, alice.id, 'Uno')
    await expectCode(teamsSvc.createTeam(db, alice.id, 'Dos'), 'LIMIT')

    await billing.grantPlan(db, { userId: alice.id }, 'user_plus')
    for (const n of ['Dos', 'Tres', 'Cuatro', 'Cinco']) await teamsSvc.createTeam(db, alice.id, n)
    await expectCode(teamsSvc.createTeam(db, alice.id, 'Seis'), 'LIMIT')

    await billing.grantPlan(db, { userId: alice.id }, 'user_pro')
    await teamsSvc.createTeam(db, alice.id, 'Seis')
  })

  it('el espacio personal no cuenta como equipo propio', async () => {
    expect((await billing.getMyBilling(db, alice.id)).usage.owned_teams).toBe(0)
    await teamsSvc.createTeam(db, alice.id, 'Uno')
    expect((await billing.getMyBilling(db, alice.id)).usage.owned_teams).toBe(1)
  })
})

describe('miembros por equipo', () => {
  it('Gratis admite 5 (por correo y por enlace) y Plus sube a 15', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    const people = []
    for (const n of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) people.push(await createUser(db, n))
    for (const p of people.slice(0, 4)) await teamsSvc.inviteMember(db, alice.id, team.id, `${p.name.toLowerCase()}@test.dev`)
    // Alice + 4 = 5: el sexto no entra por ninguna vía.
    await expectCode(teamsSvc.inviteMember(db, alice.id, team.id, 'p5@test.dev'), 'LIMIT')
    const { token } = await invitesSvc.createInvite(db, alice.id, team.id, 'member')
    await expectCode(invitesSvc.acceptInvite(db, people[5].id, token), 'LIMIT')

    await billing.grantPlan(db, { teamId: team.id }, 'team_plus')
    await teamsSvc.inviteMember(db, alice.id, team.id, 'p5@test.dev')
    await invitesSvc.acceptInvite(db, people[5].id, token)
    expect((await billing.getTeamBilling(db, alice.id, team.id)).usage.members).toBe(7)
  })

  it('quien ya es miembro recibe CONFLICT, no LIMIT, aunque el equipo esté lleno', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev')
    await expectCode(teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev'), 'CONFLICT')
  })

  it('bajar de plan no expulsa a nadie: solo frena las altas nuevas', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await billing.grantPlan(db, { teamId: team.id }, 'team_plus')
    for (const n of ['P1', 'P2', 'P3', 'P4', 'P5']) {
      const u = await createUser(db, n)
      await teamsSvc.inviteMember(db, alice.id, team.id, `${u.name.toLowerCase()}@test.dev`)
    }
    await db.update(subscriptions).set({ ends_at: new Date(Date.now() - 1000).toISOString() }).where(eq(subscriptions.team_id, team.id))
    expect((await billing.getTeamBilling(db, alice.id, team.id)).plan).toBe('team_free')
    expect((await teamsSvc.listMembers(db, alice.id, team.id)).length).toBe(6)
    await expectCode(teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev'), 'LIMIT')
  })
})

describe('espacio de adjuntos', () => {
  async function withTask(teamId: string) {
    return tasksSvc.createTask(db, alice.id, teamId, { title: 'T' })
  }
  const att = (taskId: string, size: number) =>
    attSvc.recordAttachment(db, alice.id, { task_id: taskId, file_name: 'a.pdf', file_path: `attachments/${taskId}-${size}.pdf`, file_type: 'application/pdf', size })

  it('el equipo gratis tiene 100 MB y Plus 5 GB', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    const t = await withTask(team.id)
    await att(t.id, 99 * MB)
    await attSvc.authorizeUpload(db, alice.id, { taskId: t.id, size: 1 * MB }) // 100 MB justos
    await expectCode(attSvc.authorizeUpload(db, alice.id, { taskId: t.id, size: 2 * MB }), 'LIMIT')

    await billing.grantPlan(db, { teamId: team.id }, 'team_plus')
    await attSvc.authorizeUpload(db, alice.id, { taskId: t.id, size: 2 * MB })
  })

  it('cuenta también los adjuntos de comentarios', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    const t = await withTask(team.id)
    const { comments } = await import('@/db/schema')
    const [c] = await db.insert(comments).values({ task_id: t.id, user_id: alice.id, content: 'x' }).returning()
    await attSvc.recordAttachment(db, alice.id, { comment_id: c.id, file_name: 'b.pdf', file_path: 'attachments/c.pdf', file_type: 'application/pdf', size: 60 * MB })
    expect(await billing.teamStorageUsed(db, team.id)).toBe(60 * MB)
  })

  it('el espacio personal usa el plan personal (100 MB, 2 GB con Plus)', async () => {
    const t = await withTask(alice.team.id)
    await att(t.id, 100 * MB)
    await expectCode(attSvc.authorizeUpload(db, alice.id, { taskId: t.id, size: 1 }), 'LIMIT')
    await billing.grantPlan(db, { userId: alice.id }, 'user_plus')
    await attSvc.authorizeUpload(db, alice.id, { taskId: t.id, size: 500 * MB })
  })

  it('sin tamaño no se comprueba el espacio (el registro posterior reutiliza authorizeUpload)', async () => {
    const t = await withTask(alice.team.id)
    await att(t.id, 100 * MB)
    await attSvc.authorizeUpload(db, alice.id, { taskId: t.id })
  })
})

describe('avisos por tarea', () => {
  it('Gratis permite 2, Plus 4 y Pro 6; reducir siempre se puede', async () => {
    await expectCode(billing.assertCanSetReminderOffsets(db, alice.id, 3, 2), 'LIMIT')
    await billing.assertCanSetReminderOffsets(db, alice.id, 2, 2)
    await billing.grantPlan(db, { userId: alice.id }, 'user_plus')
    await billing.assertCanSetReminderOffsets(db, alice.id, 4, 2)
    await expectCode(billing.assertCanSetReminderOffsets(db, alice.id, 5, 2), 'LIMIT')
    await billing.grantPlan(db, { userId: alice.id }, 'user_pro')
    await billing.assertCanSetReminderOffsets(db, alice.id, 6, 2)
    // Con más de los permitidos guardados (bajó de plan) puede dejarlos igual o quitar alguno.
    await db.update(subscriptions).set({ ends_at: new Date(Date.now() - 1000).toISOString() }).where(eq(subscriptions.user_id, alice.id))
    await billing.assertCanSetReminderOffsets(db, alice.id, 4, 4)
    await billing.assertCanSetReminderOffsets(db, alice.id, 3, 4)
    await expectCode(billing.assertCanSetReminderOffsets(db, alice.id, 5, 4), 'LIMIT')
  })
})

describe('plan Pro de equipo', () => {
  it('regala Personal Plus a sus miembros y solo mientras dure', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev')
    expect(await billing.userPlanOf(db, bob.id)).toBe('user_free')

    await billing.grantPlan(db, { teamId: team.id }, 'team_pro')
    expect(await billing.userPlanOf(db, bob.id)).toBe('user_plus')
    expect((await billing.getMyBilling(db, bob.id)).source).toBe('team')

    // Un plan personal mejor que el regalo manda.
    await billing.grantPlan(db, { userId: bob.id }, 'user_pro')
    expect(await billing.userPlanOf(db, bob.id)).toBe('user_pro')
    expect((await billing.getMyBilling(db, bob.id)).source).toBe('own')

    // Un ajeno al equipo no recibe nada.
    const carol = await createUser(db, 'Carol')
    expect(await billing.userPlanOf(db, carol.id)).toBe('user_free')
  })

  it('Plus de equipo no regala nada', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev')
    await billing.grantPlan(db, { teamId: team.id }, 'team_plus')
    expect(await billing.userPlanOf(db, bob.id)).toBe('user_free')
  })
})

describe('prueba gratuita', () => {
  it(`dura ${TRIAL_DAYS} días y solo se usa una vez por persona`, async () => {
    expect((await billing.getMyBilling(db, alice.id)).own.trial_available).toBe(true)
    await billing.startTrial(db, alice.id, { plan: 'user_plus' })
    const b = await billing.getMyBilling(db, alice.id)
    expect(b.plan).toBe('user_plus')
    expect(b.own).toMatchObject({ status: 'trialing', trial_available: false })
    const days = (new Date(b.own.ends_at!).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(TRIAL_DAYS - 0.1)
    expect(days).toBeLessThanOrEqual(TRIAL_DAYS)
    await expectCode(billing.startTrial(db, alice.id, { plan: 'user_pro' }), 'CONFLICT')
  })

  it('al caducar vuelve a Gratis y no se puede repetir', async () => {
    await billing.startTrial(db, alice.id, { plan: 'user_pro' })
    await db.update(subscriptions).set({ ends_at: new Date(Date.now() - 1000).toISOString() }).where(eq(subscriptions.user_id, alice.id))
    const b = await billing.getMyBilling(db, alice.id)
    expect(b.plan).toBe('user_free')
    expect(b.own.status).toBe('free')
    await expectCode(billing.startTrial(db, alice.id, { plan: 'user_plus' }), 'CONFLICT')
  })

  it('no se puede probar el plan gratuito ni uno del otro tipo', async () => {
    await expectCode(billing.startTrial(db, alice.id, { plan: 'user_free' }), 'INVALID')
    await expectCode(billing.startTrial(db, alice.id, { plan: 'team_plus' as never }), 'INVALID')
  })

  it('en un equipo solo la administración puede probarlo, y una vez', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev')
    await expectCode(billing.startTrial(db, bob.id, { teamId: team.id, plan: 'team_plus' }), 'FORBIDDEN')
    await billing.startTrial(db, alice.id, { teamId: team.id, plan: 'team_plus' })
    expect((await billing.getTeamBilling(db, bob.id, team.id)).plan).toBe('team_plus')
    await expectCode(billing.startTrial(db, alice.id, { teamId: team.id, plan: 'team_pro' }), 'CONFLICT')
  })

  it('un ajeno no puede probar planes de un equipo que no es suyo', async () => {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await expectCode(billing.startTrial(db, bob.id, { teamId: team.id, plan: 'team_plus' }), 'FORBIDDEN')
  })

  it('el espacio personal no tiene plan de equipo', async () => {
    await expectCode(billing.startTrial(db, alice.id, { teamId: alice.team.id, plan: 'team_plus' }), 'INVALID')
    const b = await billing.getTeamBilling(db, alice.id, alice.team.id)
    expect(b).toMatchObject({ personal: true, plan: 'team_free', limits: { maxMembers: 1 } })
  })
})

describe('concesión manual', () => {
  it('rechaza un plan del tipo equivocado y sustituye lo anterior', async () => {
    await expectCode(billing.grantPlan(db, { userId: alice.id }, 'team_pro'), 'INVALID')
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
    await expectCode(billing.grantPlan(db, { teamId: team.id }, 'user_pro'), 'INVALID')
    await expectCode(billing.grantPlan(db, { userId: alice.id }, 'nada' as never), 'INVALID')

    await billing.startTrial(db, alice.id, { plan: 'user_plus' })
    await billing.grantPlan(db, { userId: alice.id }, 'user_pro', { days: 30 })
    const b = await billing.getMyBilling(db, alice.id)
    expect(b.own).toMatchObject({ plan: 'user_pro', status: 'active' })
    expect(b.own.ends_at).not.toBeNull()
    await db.select().from(subscriptions).where(eq(subscriptions.user_id, alice.id)).then((r) => expect(r).toHaveLength(1))
  })
})

describe('exportación', () => {
  async function seed() {
    const team = await teamsSvc.createTeam(db, alice.id, 'Equipo Ñandú')
    await teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev', 'member')
    await tasksSvc.createTask(db, alice.id, team.id, { title: '=HYPERLINK("http://x")', description: 'línea 1\nlínea 2, con "comillas"' })
    await tasksSvc.createTask(db, alice.id, team.id, { title: 'Normal' })
    return team
  }

  it('el equipo gratis no exporta; Plus exporta CSV; el JSON completo es de Pro', async () => {
    const team = await seed()
    await expectCode(exportSvc.exportTeam(db, alice.id, team.id, 'csv'), 'LIMIT')
    await billing.grantPlan(db, { teamId: team.id }, 'team_plus')
    const csv = await exportSvc.exportTeam(db, alice.id, team.id, 'csv')
    expect(csv.filename).toMatch(/^serenboard-equipo-nandu-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv.mime).toContain('text/csv')
    expect(csv.content.startsWith('﻿Título,')).toBe(true)
    await expectCode(exportSvc.exportTeam(db, alice.id, team.id, 'json'), 'LIMIT')

    await billing.grantPlan(db, { teamId: team.id }, 'team_pro')
    const json = JSON.parse((await exportSvc.exportTeam(db, alice.id, team.id, 'json')).content)
    expect(json.team.name).toBe('Equipo Ñandú')
    expect(json.members).toHaveLength(2)
    expect(json.tasks).toHaveLength(2)
    expect(json.tasks[0]).toHaveProperty('comments')
  })

  it('el CSV neutraliza fórmulas y escapa comillas, comas y saltos de línea', async () => {
    const team = await seed()
    await billing.grantPlan(db, { teamId: team.id }, 'team_plus')
    const { content } = await exportSvc.exportTeam(db, alice.id, team.id, 'csv')
    expect(content).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"")
    expect(content).not.toMatch(/^=/m)
    expect(content).toContain('"línea 1\nlínea 2, con ""comillas"""')
  })

  it('solo la gestión del equipo exporta, aunque el plan lo permita', async () => {
    const team = await seed()
    await billing.grantPlan(db, { teamId: team.id }, 'team_pro')
    await expectCode(exportSvc.exportTeam(db, bob.id, team.id, 'csv'), 'FORBIDDEN')
    const carol = await createUser(db, 'Carol')
    await expectCode(exportSvc.exportTeam(db, carol.id, team.id, 'csv'), 'FORBIDDEN')
  })

  it('exportar mis tareas: Plus CSV, Pro JSON; solo las mías y de equipos donde estoy', async () => {
    const team = await seed()
    const bobsTeam = await teamsSvc.createTeam(db, bob.id, 'De Bob')
    await tasksSvc.createTask(db, bob.id, bobsTeam.id, { title: 'Ajena a Alice' })
    await expectCode(exportSvc.exportMine(db, alice.id, 'csv'), 'LIMIT')

    await billing.grantPlan(db, { userId: alice.id }, 'user_plus')
    const csv = await exportSvc.exportMine(db, alice.id, 'csv')
    expect(csv.content).toContain('Normal')
    expect(csv.content).not.toContain('Ajena a Alice')
    expect(csv.content).toContain('Equipo Ñandú')
    await expectCode(exportSvc.exportMine(db, alice.id, 'json'), 'LIMIT')

    await billing.grantPlan(db, { userId: alice.id }, 'user_pro')
    const json = JSON.parse((await exportSvc.exportMine(db, alice.id, 'json')).content)
    expect(json.tasks.every((t: { team: string }) => t.team === 'Equipo Ñandú')).toBe(true)
    void team
  })
})
