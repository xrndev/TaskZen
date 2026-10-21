// @vitest-environment node
import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { teamInvites } from '@/db/schema'
import type { Db } from '@/server/db'
import * as invites from '@/server/services/invites'
import * as teamsSvc from '@/server/services/teams'
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
  team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
  await teamsSvc.inviteMember(db, alice.id, team.id, 'bob@test.dev', 'member')
})

describe('enlaces de invitación', () => {
  it('un admin crea un enlace y otra persona entra con el rol indicado', async () => {
    const { token } = await invites.createInvite(db, alice.id, team.id, 'product_owner')
    expect(await invites.previewInvite(db, token)).toMatchObject({ team_name: 'Equipo', inviter_name: 'Alice', role: 'product_owner' })
    const { team_id } = await invites.acceptInvite(db, carol.id, token)
    expect(team_id).toBe(team.id)
    const members = await teamsSvc.listMembers(db, alice.id, team.id)
    expect(members.find((m) => m.user_id === carol.id)?.role).toBe('product_owner')
  })

  it('aceptar dos veces no cambia el rol de quien ya es miembro', async () => {
    const { token } = await invites.createInvite(db, alice.id, team.id, 'member')
    await invites.acceptInvite(db, carol.id, token)
    const members = await teamsSvc.listMembers(db, alice.id, team.id)
    expect(members.find((m) => m.user_id === carol.id)?.role).toBe('product_owner')
  })

  it('solo un admin puede crear, listar o revocar', async () => {
    await expectCode(invites.createInvite(db, bob.id, team.id), 'FORBIDDEN')
    await expectCode(invites.listInvites(db, bob.id, team.id), 'FORBIDDEN')
    const { invite } = await invites.createInvite(db, alice.id, team.id)
    await expectCode(invites.revokeInvite(db, bob.id, invite.id), 'FORBIDDEN')
    await expectCode(invites.createInvite(db, carol.id, team.id), 'FORBIDDEN')
  })

  it('no se puede conceder admin ni invitar a un espacio personal', async () => {
    await expectCode(invites.createInvite(db, alice.id, team.id, 'admin'), 'INVALID')
    await expectCode(invites.createInvite(db, alice.id, alice.team.id), 'INVALID')
  })

  it('un enlace revocado deja de funcionar', async () => {
    const { token, invite } = await invites.createInvite(db, alice.id, team.id)
    await invites.revokeInvite(db, alice.id, invite.id)
    await expectCode(invites.previewInvite(db, token), 'NOT_FOUND')
    await expectCode(invites.acceptInvite(db, bob.id, token), 'NOT_FOUND')
  })

  it('un enlace caducado deja de funcionar', async () => {
    const { token, invite } = await invites.createInvite(db, alice.id, team.id)
    await db.update(teamInvites).set({ expires_at: new Date(Date.now() - 1000).toISOString() }).where(eq(teamInvites.id, invite.id))
    await expectCode(invites.acceptInvite(db, bob.id, token), 'NOT_FOUND')
    expect((await invites.listInvites(db, alice.id, team.id)).some((i) => i.id === invite.id)).toBe(false)
  })

  it('un token inventado se rechaza y el token no se guarda en claro', async () => {
    await expectCode(invites.previewInvite(db, 'token-inventado'), 'NOT_FOUND')
    const { token } = await invites.createInvite(db, alice.id, team.id)
    const rows = await db.select().from(teamInvites)
    expect(rows.some((r) => r.token_hash === token)).toBe(false)
    expect(rows.every((r) => r.token_hash.length === 64)).toBe(true)
  })
})
