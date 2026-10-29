'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Crown, X } from 'lucide-react'
import { TRIAL_DAYS } from '@/lib/plans'
import { openSettings, subscribeUpgrade, type UpgradeRequest } from '@/lib/upgrade'

/** Se abre al alcanzar un límite del plan: explica qué pasó y lleva directo al sitio donde probar o mejorar el plan. */
export function UpgradeDialog() {
  const [req, setReq] = useState<UpgradeRequest | null>(null)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => subscribeUpgrade(setReq), [])

  useEffect(() => {
    if (!req) return
    primary.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setReq(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req])

  if (!req) return null
  const team = req.scope === 'team'

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setReq(null)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="upgrade-title" className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-surface-container-low p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <button type="button" onClick={() => setReq(null)} className="absolute right-4 top-4 rounded-full p-2 hover:bg-surface-container-highest" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Crown className="h-5 w-5" aria-hidden /></div>
        <h2 id="upgrade-title" className="mt-4 text-lg font-bold text-on-surface">Has llegado al límite de tu plan</h2>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{req.message}</p>
        <p className="mt-3 text-sm text-on-surface">Puedes probar un plan de pago <strong>{TRIAL_DAYS} días gratis, sin tarjeta</strong>.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            ref={primary}
            type="button"
            onClick={() => { setReq(null); openSettings(team ? 'team' : 'profile') }}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dim px-4 py-3 text-xs font-extrabold uppercase tracking-widest text-black hover:brightness-110"
          >
            {team ? 'Ver el plan del equipo' : 'Ver mi plan'}
          </button>
          <Link href="/precios" target="_blank" className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-outline-variant/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface hover:border-primary hover:text-primary">
            Comparar planes
          </Link>
        </div>
        <button type="button" onClick={() => setReq(null)} className="mt-3 w-full text-center text-xs font-semibold text-on-surface-variant hover:text-on-surface">Ahora no</button>
      </div>
    </div>
  )
}
