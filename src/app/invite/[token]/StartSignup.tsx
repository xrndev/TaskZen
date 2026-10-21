'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Guarda la invitación en una cookie (el registro es solo por invitación) y lleva al acceso. */
export function StartSignup({ token }: { token: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/invite/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      if (!res.ok) throw new Error('claim')
      router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
    } catch {
      setError('No se pudo validar la invitación. Recarga la página o pide un enlace nuevo.')
      setBusy(false)
    }
  }

  return (
    <>
      {error && <p role="alert" className="text-sm text-error mb-3">{error}</p>}
      <button onClick={start} disabled={busy} className="block w-full bg-gradient-to-br from-primary to-primary-dim text-black font-semibold py-3 px-4 rounded-xl disabled:opacity-60">
        {busy ? 'Un momento…' : 'Crear cuenta o iniciar sesión'}
      </button>
    </>
  )
}
