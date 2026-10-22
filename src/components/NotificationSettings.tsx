'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from '@/lib/toast';
import { urlBase64ToUint8Array, usePushEnvironment } from '@/lib/pushSupport';
import {
  getNotificationStateAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
  updateNotificationPrefsAction,
} from '@/server/actions/notifications';

interface Prefs {
  enabled: boolean;
  due_soon: boolean;
  assigned: boolean;
  offsets_minutes: number[];
  quiet_start: string | null;
  quiet_end: string | null;
  timezone: string;
}

const LABEL: Record<number, string> = { 5: '5 min', 15: '15 min', 30: '30 min', 60: '1 hora', 120: '2 horas', 180: '3 horas', 360: '6 horas', 720: '12 horas', 1440: '1 día', 2880: '2 días' };
const BTN = 'w-full min-h-11 rounded-lg px-3 text-[11px] font-extrabold uppercase tracking-widest transition-all disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary';
const CHIP = 'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary';
const TIME = 'h-11 w-full rounded-lg border border-outline-variant/30 bg-surface-container px-3 text-sm text-on-surface focus:border-primary focus:outline-none';

export function NotificationSettings() {
  const env = usePushEnvironment();
  const [state, setState] = useState<{ publicKey: string | null; prefs: Prefs; devices: number; allowedOffsets: number[] } | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [thisDevice, setThisDevice] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await getNotificationStateAction();
    if (!r.ok) return toast.error(r.error);
    setState(r.data);
    setPrefs(r.data.prefs);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial al abrir el perfil
    load();
  }, [load]);

  useEffect(() => {
    if (!env.supported) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee el estado real del navegador al montar
    setPermission(Notification.permission);
    navigator.serviceWorker.getRegistration('/sw.js').then((reg) => reg?.pushManager.getSubscription()).then((sub) => setThisDevice(!!sub)).catch(() => {});
  }, [env.supported]);

  const enableHere = async () => {
    if (!state?.publicKey) return;
    // El permiso se pide ANTES de cualquier await: Safari lo ignora si ya se perdió el gesto del toque.
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') return toast.error('No has permitido las notificaciones. Puedes cambiarlo en los ajustes del navegador.');
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(state.publicKey) }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Suscripción incompleta');
      const r = await savePushSubscriptionAction({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }, navigator.userAgent, Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (!r.ok) throw new Error(r.error);
      setThisDevice(true);
      toast.success('Avisos activados en este dispositivo.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? `No se pudo activar: ${e.message}` : 'No se pudo activar en este dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  const disableHere = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setThisDevice(false);
      toast.info('Avisos desactivados en este dispositivo.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!prefs) return;
    setBusy(true);
    const r = await updateNotificationPrefsAction({ ...prefs, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setPrefs(r.data);
    toast.success('Preferencias guardadas.');
  };

  const test = async () => {
    setBusy(true);
    const r = await sendTestPushAction();
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    if (r.data.sent > 0) toast.success('Aviso de prueba enviado. Debería llegarte en unos segundos.');
    else toast.error('No se pudo entregar la prueba. Desactiva y vuelve a activar los avisos en este dispositivo.');
  };

  const patch = (p: Partial<Prefs>) => setPrefs((cur) => (cur ? { ...cur, ...p } : cur));
  const toggleOffset = (m: number) => patch({ offsets_minutes: prefs?.offsets_minutes.includes(m) ? prefs.offsets_minutes.filter((x) => x !== m) : [...(prefs?.offsets_minutes ?? []), m] });

  let intro: React.ReactNode = null;
  if (!state) intro = <p className="text-xs text-on-surface-variant">Cargando…</p>;
  else if (!state.publicKey) intro = <p className="text-xs text-on-surface-variant">Los avisos no están configurados en el servidor.</p>;
  else if (!env.supported && env.isIOS && !env.standalone) {
    intro = (
      <p className="text-xs leading-relaxed text-on-surface-variant">
        En iPhone los avisos solo funcionan con TaskZen abierta desde el icono de la pantalla de inicio. Añádela desde Safari (<strong>Compartir → Añadir a pantalla de inicio</strong>) y vuelve aquí. <Link href="/instalar" className="font-semibold text-primary underline">Ver instrucciones</Link>.
      </p>
    );
  } else if (!env.supported) intro = <p className="text-xs text-on-surface-variant">Este navegador no admite notificaciones.</p>;
  else if (permission === 'denied' && !thisDevice) intro = <p className="text-xs leading-relaxed text-error">Has bloqueado las notificaciones de este sitio. Actívalas en los ajustes del navegador y vuelve a intentarlo.</p>;

  const canToggle = !!state?.publicKey && env.supported && !(permission === 'denied' && !thisDevice);

  return (
    <section className="mt-6 flex flex-col gap-4 border-t border-outline-variant/10 pt-4" aria-labelledby="notif-title">
      <h3 id="notif-title" className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">
        {thisDevice ? <Bell className="h-4 w-4 text-primary" aria-hidden /> : <BellOff className="h-4 w-4 text-primary" aria-hidden />} Notificaciones
      </h3>
      {intro}

      {canToggle && (
        thisDevice ? (
          <button type="button" onClick={disableHere} disabled={busy} className={`${BTN} border border-outline-variant/30 text-on-surface hover:border-error hover:text-error`}>Desactivar en este dispositivo</button>
        ) : (
          <button type="button" onClick={enableHere} disabled={busy} className={`${BTN} bg-primary text-black`}>Activar avisos en este dispositivo</button>
        )
      )}

      {state && state.devices > 0 && prefs && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant" aria-live="polite">{state.devices === 1 ? '1 dispositivo recibe avisos.' : `${state.devices} dispositivos reciben avisos.`}</p>

          <label className="flex min-h-11 items-center gap-3 text-sm text-on-surface">
            <input type="checkbox" checked={prefs.due_soon} onChange={(e) => patch({ due_soon: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)]" />
            Cuando una tarea mía esté por vencer
          </label>
          {prefs.due_soon && (
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Avisarme con esta antelación (hasta 4)</legend>
              <div className="flex flex-wrap gap-2">
                {state.allowedOffsets.map((m) => {
                  const on = prefs.offsets_minutes.includes(m);
                  return (
                    <button key={m} type="button" aria-pressed={on} onClick={() => toggleOffset(m)} className={`${CHIP} ${on ? 'border-primary bg-primary/20 text-primary' : 'border-outline-variant/30 text-on-surface hover:bg-surface-container-high'}`}>{LABEL[m] ?? `${m} min`}</button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label className="flex min-h-11 items-center gap-3 text-sm text-on-surface">
            <input type="checkbox" checked={prefs.assigned} onChange={(e) => patch({ assigned: e.target.checked })} className="h-5 w-5 accent-[var(--color-primary)]" />
            Cuando me asignen una tarea
          </label>

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Horas de silencio (opcional)</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-on-surface">Desde<input type="time" value={prefs.quiet_start ?? ''} onChange={(e) => patch({ quiet_start: e.target.value || null })} className={TIME} /></label>
              <label className="flex flex-col gap-1 text-xs text-on-surface">Hasta<input type="time" value={prefs.quiet_end ?? ''} onChange={(e) => patch({ quiet_end: e.target.value || null })} className={TIME} /></label>
            </div>
            <p className="mt-2 text-[11px] text-on-surface-variant">Los avisos que caigan en ese tramo se envían al terminar, si la tarea aún no ha vencido.</p>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={save} disabled={busy} className={`${BTN} bg-primary text-black`}>Guardar</button>
            <button type="button" onClick={test} disabled={busy} className={`${BTN} border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary`}>Enviar prueba</button>
          </div>
        </div>
      )}
    </section>
  );
}
