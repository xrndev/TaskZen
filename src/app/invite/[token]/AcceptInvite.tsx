'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInviteAction } from '@/server/actions/invites'

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    setBusy(true)
    setError(null)
    const r = await acceptInviteAction(token)
    if (r.ok) router.replace(`/board?team=${r.data.team_id}`)
    else {
      setError(r.error)
      setBusy(false)
    }
  }

  return (
    <>
      {error && <p role="alert" className="text-sm text-error mb-3">{error}</p>}
      <button onClick={accept} disabled={busy} className="w-full bg-gradient-to-br from-primary to-primary-dim text-black font-semibold py-3 px-4 rounded-xl disabled:opacity-60">
        {busy ? 'Uniéndote…' : 'Unirme al equipo'}
      </button>
    </>
  )
}
