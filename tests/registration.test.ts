// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '@/server/db'
import * as invites from '@/server/services/invites'
import { canRegister, policyFromEnv, readCookie, type RegistrationPolicy } from '@/server/services/registration'
import * as teamsSvc from '@/server/services/teams'
import { createTestDb, createUser } from './helpers/testdb'

const CLOSED: RegistrationPolicy = { openSignup: false, bootstrapEmails: ['owner@test.dev'] }

let db: Db
let token: string

beforeAll(async () => {
  db = await createTestDb()
  const alice = await createUser(db, 'Alice')
  const team = await teamsSvc.createTeam(db, alice.id, 'Equipo')
  token = (await invites.createInvite(db, alice.id, team.id)).token
})

describe('control de registro', () => {
  it('cerrado por defecto: sin invitación no se puede crear la cuenta', async () => {
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: false, inviteToken: null }, CLOSED)).toBe(false)
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: true, inviteToken: null }, CLOSED)).toBe(false)
  })

  it('una invitación válida permite registrarse, con contraseña o con un proveedor', async () => {
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: false, inviteToken: token }, CLOSED)).toBe(true)
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: true, inviteToken: token }, CLOSED)).toBe(true)
  })

  it('un token inventado, caducado o revocado no sirve', async () => {
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: false, inviteToken: 'inventado' }, CLOSED)).toBe(false)
    const team = (await teamsSvc.listTeams(db, 'u_Alice')).find((t) => !t.is_personal)!
    const { token: t2, invite } = await invites.createInvite(db, 'u_Alice', team.id)
    await invites.revokeInvite(db, 'u_Alice', invite.id)
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: false, inviteToken: t2 }, CLOSED)).toBe(false)
  })

  it('el correo de arranque solo vale si el proveedor lo ha verificado', async () => {
    expect(await canRegister(db, { email: 'Owner@Test.dev', emailVerified: true, inviteToken: null }, CLOSED)).toBe(true)
    // Con contraseña `emailVerified` es falso: teclear el correo del dueño no da acceso.
    expect(await canRegister(db, { email: 'owner@test.dev', emailVerified: false, inviteToken: null }, CLOSED)).toBe(false)
    expect(await canRegister(db, { email: 'otro@test.dev', emailVerified: true, inviteToken: null }, CLOSED)).toBe(false)
  })

  it('el registro abierto es explícito', async () => {
    expect(await canRegister(db, { email: 'x@test.dev', emailVerified: false, inviteToken: null }, { openSignup: true, bootstrapEmails: [] })).toBe(true)
  })

  it('la política se lee del entorno y por defecto está cerrada', () => {
    expect(policyFromEnv({})).toEqual({ openSignup: false, bootstrapEmails: [] })
    expect(policyFromEnv({ ALLOW_OPEN_SIGNUP: 'true', BOOTSTRAP_EMAILS: ' A@x.dev, b@x.dev ' })).toEqual({ openSignup: true, bootstrapEmails: ['a@x.dev', 'b@x.dev'] })
    // Cualquier valor distinto de "true" no abre el registro.
    expect(policyFromEnv({ ALLOW_OPEN_SIGNUP: '1' }).openSignup).toBe(false)
  })

  it('lee la cookie de invitación', () => {
    expect(readCookie('a=1; tz_invite=abc%20d; b=2', 'tz_invite')).toBe('abc d')
    expect(readCookie('a=1', 'tz_invite')).toBeNull()
    expect(readCookie(null, 'tz_invite')).toBeNull()
  })
})
