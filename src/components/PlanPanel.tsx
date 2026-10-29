'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Download, Lock, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from '@/lib/toast';
import { reportError } from '@/lib/upgrade';
import {
  formatBytes, isPaidPlan, PLANS, TEAM_PLAN_LISTED, TEAM_PLANS, TRIAL_DAYS, USER_PLAN_LISTED, USER_PLANS, type PlanState, type TeamBilling, type TeamPlanId, type UserBilling, type UserPlanId,
} from '@/lib/plans';
import {
  exportMineAction, exportTeamAction, getMyBillingAction, getTeamBillingAction, startTeamTrialAction, startUserTrialAction,
} from '@/server/actions/billing';

const BTN = 'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-widest transition-all disabled:opacity-50';

type Props = { scope: 'user' } | { scope: 'team'; teamId: string };

/** Guarda un texto como archivo descargable (el servidor entrega nombre, tipo y contenido). */
function download(file: { filename: string; mime: string; content: string }) {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

function statusText(s: PlanState['status'], endsAt: string | null) {
  if (s === 'trialing' && endsAt) return `Prueba gratuita · quedan ${daysLeft(endsAt)} días`;
  if (s === 'canceled' && endsAt) return `Se cancela el ${new Date(endsAt).toLocaleDateString()}`;
  if (s === 'active') return endsAt ? `Activo hasta el ${new Date(endsAt).toLocaleDateString()}` : 'Activo';
  return 'Plan gratuito';
}

function Meter({ label, used, max, format }: { label: string; used: number; max: number | null; format: (n: number) => string }) {
  const pct = max === null ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-on-surface-variant">
        <span>{label}</span>
        <span className="font-semibold text-on-surface">{format(used)} / {max === null ? 'sin límite' : format(max)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={max === null ? 0 : pct}>
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-error' : 'bg-primary'}`} style={{ width: `${max === null ? 4 : Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

export function PlanPanel(props: Props) {
  const teamId = props.scope === 'team' ? props.teamId : null;
  const [team, setTeam] = useState<TeamBilling | null>(null);
  const [me, setMe] = useState<UserBilling | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (teamId) {
      const r = await getTeamBillingAction(teamId);
      if (r.ok) setTeam(r.data); else toast.error(r.error);
    } else {
      const r = await getMyBillingAction();
      if (r.ok) setMe(r.data); else toast.error(r.error);
    }
  }, [teamId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga del plan al abrir el panel
    load();
  }, [load]);

  const trial = async (plan: TeamPlanId | UserPlanId) => {
    setBusy(true);
    const r = teamId ? await startTeamTrialAction(teamId, plan) : await startUserTrialAction(plan);
    setBusy(false);
    if (!r.ok) return reportError(r);
    toast.success(`Prueba de ${TRIAL_DAYS} días activada. No hace falta ningún dato de pago.`);
    load();
  };

  const exportAs = async (format: 'csv' | 'json') => {
    setBusy(true);
    const r = teamId ? await exportTeamAction(teamId, format) : await exportMineAction(format);
    setBusy(false);
    if (!r.ok) return reportError(r);
    download(r.data);
  };

  const data = teamId ? team : me;
  if (!data) return <p className="text-xs text-on-surface-variant">Cargando plan…</p>;

  const isTeam = data.scope === 'team';
  const planName = isTeam ? (data.personal ? 'Espacio personal' : TEAM_PLANS[data.plan].name) : USER_PLANS[data.plan].name;
  const state: PlanState = isTeam ? data : data.own;
  const gifted = !isTeam && data.source === 'team';
  const canManage = isTeam ? data.is_admin && !data.personal : true;
  const trialOptions: [TeamPlanId | UserPlanId, string][] = (isTeam ? TEAM_PLAN_LISTED : USER_PLAN_LISTED).filter(isPaidPlan).map((id) => [id, PLANS[id].name]);
  const endedText = state.ended
    ? `${state.ended.trial ? 'Tu prueba de' : 'Tu plan'} ${PLANS[state.ended.plan].name} terminó el ${new Date(state.ended.ended_at).toLocaleDateString()}. No se ha borrado nada.`
    : null;
  // Un equipo que ya supera su plan (por ejemplo, tras bajar de plan) sigue funcionando, pero no admite más.
  const overMembers = isTeam && !data.personal && data.limits.maxMembers !== null && data.usage.members > data.limits.maxMembers;
  const overStorage = isTeam ? data.usage.storage_bytes > data.limits.storageBytes : data.usage.storage_bytes > data.limits.personalStorageBytes;
  const canCsv = data.limits.exportCsv;
  const canJson = data.limits.exportFull;
  const mayExport = isTeam ? data.can_export : true;

  return (
    <section className="flex flex-col gap-4" aria-labelledby={`plan-${isTeam ? 'team' : 'user'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`plan-${isTeam ? 'team' : 'user'}`} className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">
            <Crown className="h-4 w-4 text-primary" aria-hidden /> {isTeam && !data.personal ? 'Plan del equipo' : isTeam ? 'Espacio personal' : 'Tu plan'}
          </h3>
          <p className="mt-2 text-lg font-bold text-on-surface">{gifted ? USER_PLANS[data.plan].name : planName}</p>
          <p className="text-xs text-on-surface-variant" aria-live="polite">
            {gifted ? 'Incluido por un equipo con plan Pro' : isTeam && data.personal ? 'Tu espacio personal usa tu plan personal' : statusText(state.status, state.ends_at)}
          </p>
          {endedText && state.status === 'free' && <p className="mt-1 text-xs text-on-surface-variant/80">{endedText}</p>}
        </div>
        <Link href="/precios" target="_blank" className="shrink-0 text-xs font-semibold text-primary underline">Ver planes</Link>
      </div>

      {isTeam ? (
        <div className="flex flex-col gap-3">
          {!data.personal && <Meter label="Miembros" used={data.usage.members} max={data.limits.maxMembers} format={(n) => String(n)} />}
          <Meter label="Adjuntos" used={data.usage.storage_bytes} max={data.limits.storageBytes} format={formatBytes} />
          <p className="text-xs text-on-surface-variant">Archivos de hasta {formatBytes(data.limits.maxFileBytes)} cada uno.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Meter label="Equipos propios" used={data.usage.owned_teams} max={data.limits.maxOwnedTeams} format={(n) => String(n)} />
          <Meter label="Adjuntos de tu espacio personal" used={data.usage.storage_bytes} max={data.limits.personalStorageBytes} format={formatBytes} />
          <p className="text-xs text-on-surface-variant">Recordatorios antes del vencimiento: hasta {data.limits.maxReminderOffsets} por tarea. Archivos de hasta {formatBytes(data.limits.maxFileBytes)} cada uno.</p>
        </div>
      )}

      {(overMembers || overStorage) && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 p-3 text-xs text-on-surface">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
          <span>{overMembers ? 'Este equipo supera los miembros de su plan actual: sigue funcionando, pero no se podrán añadir más hasta mejorar el plan. ' : ''}{overStorage ? 'Se supera el espacio del plan: se conservan los archivos, pero no se podrán subir más. ' : ''}</span>
        </p>
      )}

      {canManage && state.trial_available && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-3 flex items-center gap-2 text-xs text-on-surface"><Sparkles className="h-4 w-4 text-primary" aria-hidden /> Prueba gratis {TRIAL_DAYS} días, sin tarjeta. Al terminar vuelves al plan gratuito sin perder nada.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {trialOptions.map(([plan, name]) => (
              <button key={plan} type="button" disabled={busy} onClick={() => trial(plan)} className={`${BTN} bg-primary text-black`}>Probar {name}</button>
            ))}
          </div>
        </div>
      )}
      {isTeam && !data.is_admin && !data.personal && state.status === 'free' && (
        <p className="text-xs text-on-surface-variant">Un administrador del equipo puede probar o mejorar el plan.</p>
      )}

      {mayExport && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Exportar {isTeam ? 'el equipo' : 'tus tareas'}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy || !canCsv} onClick={() => exportAs('csv')} className={`${BTN} border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary`} title={canCsv ? undefined : 'Disponible en los planes Plus y Pro'}>
              {canCsv ? <Download className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />} CSV {!canCsv && <span className="normal-case tracking-normal opacity-70">· Plus</span>}
            </button>
            <button type="button" disabled={busy || !canJson} onClick={() => exportAs('json')} className={`${BTN} border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary`} title={canJson ? undefined : 'Disponible en el plan Pro'}>
              {canJson ? <Download className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />} Copia JSON {!canJson && <span className="normal-case tracking-normal opacity-70">· Pro</span>}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-on-surface-variant/70">Los pagos en línea se activarán próximamente. Hasta entonces los planes se prueban gratis o los concede quien administra este servicio.</p>
    </section>
  );
}
