import { ChevronDown, ChevronUp, Crown } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import {
  formatBytes, formatPrice, isPaidPlan, PLANS, TEAM_PLAN_LISTED, TEAM_PLANS, TRIAL_DAYS, USER_PLAN_LISTED, USER_PLANS,
  type PlanId, type PlanState, type UserBilling, type UserPlanId,
} from '@domain/lib/plans'
import { apiClient } from '@/lib/client'
import { alpha, usePalette } from '@/lib/theme'
import { Btn, Label, Txt, useToast } from './ui'

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))

function statusText(b: UserBilling) {
  if (b.source === 'team') return 'Incluido por un equipo con plan Pro'
  const s: PlanState = b.own
  if (s.status === 'trialing' && s.ends_at) return `Prueba gratuita · quedan ${daysLeft(s.ends_at)} días`
  if (s.status === 'canceled' && s.ends_at) return 'Plan cancelado, activo hasta su fecha de fin'
  if (s.status === 'active') return 'Activo'
  if (s.ended?.trial) return `Tu prueba de ${PLANS[s.ended.plan].name} terminó. Estás en el plan gratuito; no se ha borrado nada.`
  return 'Plan gratuito'
}

/** Una fila de uso con barra: la app solo muestra el estado; contratar, exportar y gestionar equipos se hace en la web. */
function Meter({ label, used, max, format }: { label: string; used: number; max: number | null; format: (n: number) => string }) {
  const p = usePalette()
  const pct = max === null ? 0 : Math.min(100, Math.round((used / max) * 100))
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt size={12} color={p.onSurfaceVariant}>{label}</Txt>
        <Txt size={12} w="700">{format(used)} / {max === null ? 'sin límite' : format(max)}</Txt>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: p.highest, overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, width: `${max === null ? 3 : Math.max(pct, 3)}%`, backgroundColor: pct >= 90 ? p.error : p.primary }} />
      </View>
    </View>
  )
}

/** Planes y precios en el perfil: el mismo catálogo que la web (`@domain/lib/plans`), así que nunca difieren. */
export function PlanSettings() {
  const p = usePalette()
  const toast = useToast()
  const [billing, setBilling] = useState<UserBilling | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPlans, setShowPlans] = useState(false)

  const load = useCallback(async () => {
    try {
      setBilling(await apiClient.billing())
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  const trial = async (plan: UserPlanId) => {
    setBusy(true)
    try {
      await apiClient.startTrial(plan)
      toast(`Prueba de ${TRIAL_DAYS} días activada. No hace falta ningún dato de pago.`)
      await load()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const groups: [string, (typeof USER_PLANS)[UserPlanId][] | (typeof TEAM_PLANS)[keyof typeof TEAM_PLANS][]][] = [
    ['Para ti', USER_PLAN_LISTED.map((id) => USER_PLANS[id])],
    ['Para tu equipo', TEAM_PLAN_LISTED.map((id) => TEAM_PLANS[id])],
  ]

  return (
    <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Crown size={16} color={p.primary} />
        <Label>Tu plan</Label>
      </View>

      {!billing ? (
        <Txt size={12} color={p.onSurfaceVariant}>Cargando plan…</Txt>
      ) : (
        <View style={{ gap: 12 }}>
          <View>
            <Txt size={18} w="700">{USER_PLANS[billing.plan].name}</Txt>
            <Txt size={12} color={p.onSurfaceVariant}>{statusText(billing)}</Txt>
          </View>

          <Meter label="Equipos propios" used={billing.usage.owned_teams} max={billing.limits.maxOwnedTeams} format={(n) => String(n)} />
          <Meter label="Adjuntos de tu espacio personal" used={billing.usage.storage_bytes} max={billing.limits.personalStorageBytes} format={formatBytes} />
          <Txt size={12} color={p.onSurfaceVariant}>{`Recordatorios antes del vencimiento: hasta ${billing.limits.maxReminderOffsets} por tarea. Archivos de hasta ${formatBytes(billing.limits.maxFileBytes)} cada uno.`}</Txt>

          {billing.own.trial_available && (
            <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.primary, 0.3), backgroundColor: alpha(p.primary, 0.06) }}>
              <Txt size={12}>{`Prueba gratis ${TRIAL_DAYS} días, sin tarjeta. Al terminar vuelves al plan gratuito sin perder nada.`}</Txt>
              {USER_PLAN_LISTED.filter(isPaidPlan).map((id) => <Btn key={id} label={`Probar ${USER_PLANS[id as UserPlanId].name}`} onPress={() => trial(id as UserPlanId)} loading={busy} />)}
            </View>
          )}
        </View>
      )}

      <Btn label={showPlans ? 'Ocultar planes y precios' : 'Ver planes y precios'} variant="outline" icon={showPlans ? ChevronUp : ChevronDown} onPress={() => setShowPlans((v) => !v)} />

      {showPlans && (
        <View style={{ gap: 16 }}>
          {groups.map(([title, plans]) => (
            <View key={title} style={{ gap: 8 }}>
              <Label>{title}</Label>
              {plans.map((plan) => {
                const current = billing && plan.id === (billing.plan as PlanId)
                return (
                  <View key={plan.id} style={{ gap: 4, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(current ? p.primary : p.outline, current ? 0.5 : 0.2) }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Txt w="700" size={14}>{plan.name}{current ? ' · el tuyo' : ''}</Txt>
                      <Txt w="700" size={14}>{plan.monthly === null ? 'Gratis' : `${formatPrice(plan.monthly)} / mes`}</Txt>
                    </View>
                    <Txt size={12} color={p.onSurfaceVariant}>{plan.highlights.join(' · ')}</Txt>
                  </View>
                )
              })}
            </View>
          ))}
          <Txt size={11} color={alpha(p.onSurfaceVariant, 0.8)}>Los pagos en línea se activarán próximamente; hasta entonces los planes se prueban gratis. Precios orientativos. Para exportar datos o gestionar el plan de un equipo, usa la web.</Txt>
        </View>
      )}
    </View>
  )
}
