'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Hourglass, X } from 'lucide-react'
import { PLANS, USER_PLANS, type PlanState } from '@/lib/plans'
import { localizePlan } from '@/lib/plans.i18n'
import { useLang, useT } from '@/lib/i18n/client'
import type { Lang, T } from '@/lib/i18n/core'
import { openSettings } from '@/lib/upgrade'
import { getMyBillingAction, getTeamBillingAction } from '@/server/actions/billing'

const SOON_DAYS = 3
const ENDED_VISIBLE_DAYS = 14

interface Notice {
  /** Identifica el aviso (y su versión) para recordar que se cerró. */
  key: string
  scope: 'user' | 'team'
  tone: 'warn' | 'info'
  text: string
}

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

function noticeFor(scope: 'user' | 'team', id: string, state: PlanState, planName: string, t: T, lang: Lang): Notice | null {
  /** Qué cambia al volver al plan gratuito: los límites que más se notan. */
  const summary = t('banner.freeSummary', { teams: USER_PLANS.user_free.limits.maxOwnedTeams ?? 0, reminders: USER_PLANS.user_free.limits.maxReminderOffsets })
  if (state.status === 'trialing' && state.ends_at && daysLeft(state.ends_at) <= SOON_DAYS) {
    const n = daysLeft(state.ends_at)
    const when = n <= 0 ? t('banner.today') : n === 1 ? t('banner.tomorrow') : t('banner.inDays', { n })
    return {
      key: `${scope}:${id}:soon:${state.ends_at}`, scope, tone: 'warn',
      text: t('banner.soon', { plan: planName, when, summary }),
    }
  }
  if (state.ended?.trial && daysSince(state.ended.ended_at) <= ENDED_VISIBLE_DAYS && state.status === 'free') {
    return {
      key: `${scope}:${id}:ended:${state.ended.ended_at}`, scope, tone: 'info',
      text: t('banner.ended', { plan: localizePlan(PLANS[state.ended.plan], lang).name }),
    }
  }
  return null
}

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string) => { try { localStorage.setItem(k, '1') } catch { /* sin almacenamiento: el aviso reaparecerá */ } }

/**
 * Aviso discreto sobre el tablero cuando una prueba está a punto de terminar o acaba de terminar. Sin correo en la app,
 * es el canal para que nadie se encuentre con los límites sin saber por qué. Se puede cerrar (se recuerda en el navegador).
 */
export function PlanBanner({ teamId, isAdmin, isPersonal }: { teamId: string | null; isAdmin: boolean; isPersonal: boolean }) {
  const t = useT()
  const lang = useLang()
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const found: Notice[] = []
      const me = await getMyBillingAction()
      if (me.ok) {
        const n = noticeFor('user', 'me', me.data.own, localizePlan(USER_PLANS[me.data.own.plan], lang)?.name ?? t('banner.yourPlan'), t, lang)
        if (n) found.push(n)
      }
      // Los planes del equipo solo los gestiona la administración.
      if (teamId && isAdmin && !isPersonal) {
        const tb = await getTeamBillingAction(teamId)
        if (tb.ok) {
          const n = noticeFor('team', teamId, tb.data, localizePlan(PLANS[tb.data.plan], lang).name, t, lang)
          if (n) found.push(n)
        }
      }
      if (alive) setNotice(found.find((n) => !read(`sb.banner.${n.key}`)) ?? null)
    })()
    return () => { alive = false }
  }, [teamId, isAdmin, isPersonal, t, lang])

  if (!notice) return null
  const close = () => { write(`sb.banner.${notice.key}`); setNotice(null) }

  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5 text-sm ${notice.tone === 'warn' ? 'border-primary/30 bg-primary/10' : 'border-outline-variant/30 bg-surface-container-low'}`}>
      <Hourglass className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-on-surface">{notice.text}</p>
      <button type="button" onClick={() => { openSettings(notice.scope === 'team' ? 'team' : 'profile') }} className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">{t('banner.viewPlan')}</button>
      <Link href="/precios" target="_blank" className="text-xs font-semibold text-on-surface-variant underline hover:text-on-surface">{t('banner.compare')}</Link>
      <button type="button" onClick={close} className="rounded-full p-1.5 hover:bg-surface-container-highest" aria-label={t('banner.close')}><X className="h-4 w-4" /></button>
    </div>
  )
}
