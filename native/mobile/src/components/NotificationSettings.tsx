import { Bell, BellOff } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { Switch, View } from 'react-native'
import { OFFSET_LABEL } from '@domain/lib/reminders'
import { apiClient, type NotificationPrefs, type NotificationState } from '@/lib/client'
import { getFcmToken, registerDevice, savedToken, unregisterDevice } from '@/lib/push'
import { alpha, usePalette } from '@/lib/theme'
import { Btn, Chip, Field, Label, Txt, useToast } from './ui'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Ajustes de notificaciones de la app: los mismos que en la web (antelaciones, silencio, avisos de asignación). */
export function NotificationSettings() {
  const p = usePalette()
  const toast = useToast()
  const [state, setState] = useState<NotificationState | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [thisDevice, setThisDevice] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const s = await apiClient.notifications()
      setState(s)
      setPrefs(s.prefs)
      setThisDevice(!!(await savedToken()) && s.devices > 0)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  const enable = () => run(async () => {
    const t = await getFcmToken(true)
    if ('error' in t) return toast(t.error, 'error')
    await registerDevice(t.token)
    toast('Avisos activados en este móvil.')
    await load()
  })

  const disable = () => run(async () => {
    await unregisterDevice()
    toast('Avisos desactivados en este móvil.')
    await load()
  })

  const save = () => run(async () => {
    if (!prefs) return
    if ((prefs.quiet_start && !HHMM.test(prefs.quiet_start)) || (prefs.quiet_end && !HHMM.test(prefs.quiet_end))) throw new Error('Usa el formato HH:MM (por ejemplo 22:00).')
    setPrefs(await apiClient.updatePrefs({ ...prefs, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))
    toast('Preferencias guardadas.')
  })

  const test = () => run(async () => {
    const r = await apiClient.testPush()
    if (r.sent > 0) toast('Aviso de prueba enviado. Debería llegarte en unos segundos.')
    else toast('No se pudo entregar la prueba. Desactiva y vuelve a activar los avisos en este móvil.', 'error')
  })

  const patch = (v: Partial<NotificationPrefs>) => setPrefs((cur) => (cur ? { ...cur, ...v } : cur))
  // Se elige libremente; el tope del plan lo valida el servidor al guardar.
  const toggleOffset = (m: number) => patch({ offsets_minutes: prefs?.offsets_minutes.includes(m) ? prefs.offsets_minutes.filter((x) => x !== m) : [...(prefs?.offsets_minutes ?? []), m] })

  const row = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Txt size={14} style={{ flex: 1 }}>{label}</Txt>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: alpha(p.primary, 0.5), false: p.highest }} thumbColor={value ? p.primary : p.onSurfaceVariant} />
    </View>
  )

  return (
    <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: alpha(p.outline, 0.1) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {thisDevice ? <Bell size={16} color={p.primary} /> : <BellOff size={16} color={p.primary} />}
        <Label>Notificaciones</Label>
      </View>

      {!state ? <Txt size={12} color={p.onSurfaceVariant}>Cargando…</Txt> : !state.fcm ? (
        <Txt size={12} color={p.onSurfaceVariant}>Los avisos de la app no están configurados en el servidor.</Txt>
      ) : thisDevice ? (
        <Btn label="Desactivar en este móvil" variant="outline" onPress={disable} loading={busy} />
      ) : (
        <Btn label="Activar avisos en este móvil" onPress={enable} loading={busy} />
      )}

      {state && state.devices > 0 && prefs && (
        <View style={{ gap: 12 }}>
          <Txt size={12} color={p.onSurfaceVariant}>{state.devices === 1 ? '1 dispositivo recibe avisos.' : `${state.devices} dispositivos reciben avisos.`}</Txt>

          {row('Cuando una tarea mía esté por vencer', prefs.due_soon, (v) => patch({ due_soon: v }))}
          {prefs.due_soon && (
            <View style={{ gap: 8 }}>
              <Label>{`Avisarme con esta antelación (hasta ${state.maxOffsets})`}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {state.allowedOffsets.map((m) => <Chip key={m} label={OFFSET_LABEL[m] ?? `${m} min`} on={prefs.offsets_minutes.includes(m)} onPress={() => toggleOffset(m)} />)}
              </View>
            </View>
          )}

          {row('Cuando me asignen una tarea', prefs.assigned, (v) => patch({ assigned: v }))}

          <View style={{ gap: 8 }}>
            <Label>Horas de silencio (opcional)</Label>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Field value={prefs.quiet_start ?? ''} onChangeText={(v) => patch({ quiet_start: v || null })} placeholder="Desde 22:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={{ flex: 1 }}><Field value={prefs.quiet_end ?? ''} onChangeText={(v) => patch({ quiet_end: v || null })} placeholder="Hasta 08:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            </View>
            <Txt size={11} color={p.onSurfaceVariant}>Los avisos que caigan en ese tramo se envían al terminar, si la tarea aún no ha vencido.</Txt>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Btn label="Guardar" onPress={save} loading={busy} style={{ flex: 1 }} />
            <Btn label="Enviar prueba" variant="outline" onPress={test} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </View>
  )
}
