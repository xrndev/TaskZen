'use client';

import { Download, LogOut, Palette, Plus, Settings, Tag as TagIcon, User, Users } from 'lucide-react';
import Link from 'next/link';
import { fallbackAvatar } from '@/lib/avatar';
import type { Tag, TeamMember } from '@/types';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { BottomSheet } from './BottomSheet';

const CHIP = 'flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary';
const CHIP_ON = 'border-primary bg-primary/20 text-primary';
const CHIP_OFF = 'border-outline-variant/30 text-on-surface hover:bg-surface-container-high';
const LABEL = 'mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant';

export function MobileFiltersSheet(props: {
  open: boolean;
  onClose: () => void;
  groupBy: 'status' | 'tag';
  onGroupBy: (g: 'status' | 'tag') => void;
  showGroupBy: boolean;
  members: TeamMember[];
  assigneeId: string | null;
  onAssignee: (id: string | null) => void;
  dateRange: { start: string | null; end: string | null };
  onDateRange: (r: { start: string | null; end: string | null }) => void;
  tags: Tag[];
  tagIds: string[];
  onTagIds: (ids: string[]) => void;
  activeCount: number;
  onClear: () => void;
}) {
  const { dateRange } = props;
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Filtros">
      <div className="flex flex-col gap-6 pb-2">
        {props.showGroupBy && (
          <fieldset>
            <legend className={LABEL}>Agrupar el tablero por</legend>
            <div className="flex gap-2">
              {([['status', 'Estado'], ['tag', 'Etiqueta']] as const).map(([id, text]) => (
                <button key={id} type="button" aria-pressed={props.groupBy === id} onClick={() => props.onGroupBy(id)} className={`${CHIP} flex-1 justify-center ${props.groupBy === id ? CHIP_ON : CHIP_OFF}`}>{text}</button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className={LABEL}>Responsable</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={props.assigneeId === null} onClick={() => props.onAssignee(null)} className={`${CHIP} ${props.assigneeId === null ? CHIP_ON : CHIP_OFF}`}>
              <Users className="h-4 w-4" aria-hidden /> Todos
            </button>
            {props.members.map((m) => (
              <button key={m.user_id} type="button" aria-pressed={props.assigneeId === m.user_id} onClick={() => props.onAssignee(props.assigneeId === m.user_id ? null : m.user_id)} className={`${CHIP} ${props.assigneeId === m.user_id ? CHIP_ON : CHIP_OFF}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.profile?.avatar_url || fallbackAvatar(m.user_id)} alt="" className="h-6 w-6 rounded-full object-cover" />
                {m.profile?.full_name || 'Sin nombre'}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className={LABEL}>Fecha límite</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-on-surface">
              Desde
              <input type="date" value={dateRange.start ?? ''} onChange={(e) => props.onDateRange({ ...dateRange, start: e.target.value || null })} className="h-12 rounded-xl border border-outline-variant/30 bg-surface-container px-3 text-base text-on-surface focus:border-primary focus:outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-on-surface">
              Hasta
              <input type="date" value={dateRange.end ?? ''} onChange={(e) => props.onDateRange({ ...dateRange, end: e.target.value || null })} className="h-12 rounded-xl border border-outline-variant/30 bg-surface-container px-3 text-base text-on-surface focus:border-primary focus:outline-none" />
            </label>
          </div>
        </fieldset>

        {props.tags.length > 0 && (
          <fieldset>
            <legend className={LABEL}>Etiquetas</legend>
            <div className="flex flex-wrap gap-2">
              {props.tags.map((t) => {
                const on = props.tagIds.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => props.onTagIds(on ? props.tagIds.filter((x) => x !== t.id) : [...props.tagIds, t.id])} className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="sticky bottom-0 -mx-5 grid grid-cols-2 gap-3 border-t border-outline-variant/15 bg-surface-container-low px-5 pt-3">
          <button type="button" onClick={props.onClear} disabled={props.activeCount === 0} className="min-h-12 rounded-xl border border-outline-variant/30 text-sm font-semibold text-on-surface disabled:opacity-40">Limpiar{props.activeCount ? ` (${props.activeCount})` : ''}</button>
          <button type="button" onClick={props.onClose} className="min-h-12 rounded-xl bg-primary text-sm font-bold text-black">Ver resultados</button>
        </div>
      </div>
    </BottomSheet>
  );
}

export function MobileMoreSheet(props: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  teamName: string | null;
  onTeamSettings: () => void;
  onNewTeam: () => void;
  onTags: () => void;
  onProfile: () => void;
  onLogout: () => void;
}) {
  const row = 'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary';
  const go = (fn: () => void) => () => { props.onClose(); fn(); };
  return (
    <BottomSheet open={props.open} onClose={props.onClose} title="Más opciones">
      <div className="flex flex-col gap-1 pb-2">
        {props.isAdmin && (
          <button type="button" className={row} onClick={go(props.onTeamSettings)}>
            <Settings className="h-5 w-5 text-on-surface-variant" aria-hidden /> Gestionar equipo{props.teamName ? ` · ${props.teamName}` : ''}
          </button>
        )}
        <button type="button" className={row} onClick={go(props.onNewTeam)}><Plus className="h-5 w-5 text-on-surface-variant" aria-hidden /> Crear un equipo</button>
        <button type="button" className={row} onClick={go(props.onTags)}><TagIcon className="h-5 w-5 text-on-surface-variant" aria-hidden /> Gestionar etiquetas</button>
        <div className={`${row} cursor-default justify-between hover:bg-transparent`}>
          <span className="flex items-center gap-3"><Palette className="h-5 w-5 text-on-surface-variant" aria-hidden /> Apariencia</span>
          <ThemeSwitcher />
        </div>
        <button type="button" className={row} onClick={go(props.onProfile)}><User className="h-5 w-5 text-on-surface-variant" aria-hidden /> Mi perfil y seguridad</button>
        <Link href="/instalar" className={row} onClick={props.onClose}><Download className="h-5 w-5 text-on-surface-variant" aria-hidden /> Instalar la app o compartirla</Link>
        <div className="mt-2 border-t border-outline-variant/15 pt-2">
          <button type="button" className={`${row} text-error`} onClick={go(props.onLogout)}><LogOut className="h-5 w-5" aria-hidden /> Cerrar sesión</button>
        </div>
      </div>
    </BottomSheet>
  );
}
