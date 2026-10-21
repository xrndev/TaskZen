import Link from 'next/link'
import { db } from '@/server/db'
import { ServiceError } from '@/server/services/common'
import { previewInvite } from '@/server/services/invites'
import { getSession } from '@/server/session'
import { AcceptInvite } from './AcceptInvite'
import { StartSignup } from './StartSignup'

export const dynamic = 'force-dynamic'

const ROLE = { product_owner: 'Product Owner', member: 'Miembro', admin: 'Administrador' } as const

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params

  let info: Awaited<ReturnType<typeof previewInvite>> | null = null
  try {
    info = await previewInvite(db, token)
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e
  }
  const session = info ? await getSession() : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm p-8 bg-surface-container-low rounded-2xl border border-surface-container-high text-center shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        {!info ? (
          <>
            <h1 className="text-2xl font-bold mb-2 text-on-surface tracking-tight">Invitación no válida</h1>
            <p className="text-sm text-on-surface-variant mb-6">El enlace ha caducado o fue revocado. Pide uno nuevo a quien te invitó.</p>
            <Link href="/login" className="text-sm font-semibold text-primary">Ir al acceso</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2 text-on-surface tracking-tight">Te han invitado a {info.team_name}</h1>
            <p className="text-sm text-on-surface-variant mb-6">
              {info.inviter_name} te invita a unirte como <strong className="text-on-surface">{ROLE[info.role]}</strong>.
            </p>
            {session ? (
              <AcceptInvite token={token} />
            ) : (
              <StartSignup token={token} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
