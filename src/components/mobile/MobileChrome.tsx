'use client';

import { useT } from '@/lib/i18n/client';
import { useEffect, useRef } from 'react';
import { ArrowLeft, CalendarDays, LayoutGrid, List, Menu, Plus, Search, SlidersHorizontal } from 'lucide-react';
import type { Task, Team } from '@/types';
import { DueSoonBell } from '../DueSoonBell';

export type MobileView = 'board' | 'list' | 'calendar';

const ICON_BTN = 'relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary';

/** Cabecera compacta: una sola fila (dos mientras se busca), con espacio para la muesca del iPhone. */
export function MobileHeader(props: {
  teams: Team[];
  teamId: string | null;
  onTeamChange: (value: string) => void;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  filtersCount: number;
  onFilters: () => void;
  tasks: Task[];
  userId: string;
  onOpenTask: (t: Task) => void;
  avatarUrl: string;
  onProfile: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.searchOpen) input.current?.focus();
  }, [props.searchOpen]);

  return (
    <header
      className="shrink-0 border-b border-surface-container-high bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))', paddingRight: 'max(12px, env(safe-area-inset-right, 0px))' }}
    >
      {props.searchOpen ? (
        <div className="flex h-14 items-center gap-2">
          <button type="button" aria-label={t('m.closeSearch')} className={ICON_BTN} onClick={() => { props.onSearchOpen(false); }}>
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
          <input
            ref={input}
            id="mobile-search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            aria-label={t('m.searchTasks')}
            placeholder={t('m.searchTasks')}
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 text-base text-on-surface placeholder:text-on-surface/60 focus:border-primary focus:outline-none"
          />
        </div>
      ) : (
        <div className="flex h-14 items-center gap-1">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('m.team')}</span>
            <select
              value={props.teamId ?? ''}
              onChange={(e) => props.onTeamChange(e.target.value)}
              className="h-11 w-full truncate rounded-xl bg-transparent px-2 text-[15px] font-bold text-on-surface focus:outline-2 focus:outline-primary"
            >
              {props.teams.map((team) => <option key={team.id} value={team.id} className="bg-surface-container text-on-surface">{team.name}</option>)}
              <option value="NEW_TEAM" className="bg-surface-container text-primary">{t('m.newTeamOpt')}</option>
            </select>
          </label>
          <button type="button" aria-label={t('m.search')} className={ICON_BTN} onClick={() => props.onSearchOpen(true)}>
            <Search className="h-5 w-5" aria-hidden />
            {props.query && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" aria-label={t('m.searchActive')} />}
          </button>
          <button type="button" aria-label={props.filtersCount ? t('m.filtersActive', { n: props.filtersCount }) : t('m.filters')} className={ICON_BTN} onClick={props.onFilters}>
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
            {props.filtersCount > 0 && <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-black text-black" aria-hidden>{props.filtersCount}</span>}
          </button>
          <DueSoonBell tasks={props.tasks} userId={props.userId} onOpen={props.onOpenTask} size="lg" />
          <button type="button" aria-label={t('m.profile')} onClick={props.onProfile} className={ICON_BTN}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.avatarUrl} alt="" className="h-9 w-9 rounded-full border-2 border-outline-variant/30 object-cover" />
          </button>
        </div>
      )}
    </header>
  );
}

const NAV = [
  { id: 'board', key: 'm.nav.board', icon: LayoutGrid },
  { id: 'list', key: 'm.nav.list', icon: List },
  { id: 'calendar', key: 'm.nav.calendar', icon: CalendarDays },
  { id: 'more', key: 'm.nav.more', icon: Menu },
] as const;

/** Navegación inferior (zona del pulgar) y botón flotante de nueva tarea. */
export function MobileNav({ view, onView, onMore, onNewTask }: { view: MobileView; onView: (v: MobileView) => void; onMore: () => void; onNewTask: () => void }) {
  const t = useT();
  return (
    <>
      <button
        type="button"
        onClick={onNewTask}
        aria-label={t('m.newTask')}
        className="fixed z-40 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-black shadow-lg shadow-primary/30 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        style={{ right: 'max(16px, env(safe-area-inset-right, 0px))', bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Plus className="h-7 w-7" aria-hidden />
      </button>

      <nav
        aria-label={t('m.mainNav')}
        className="grid shrink-0 grid-cols-4 border-t border-surface-container-high bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
      >
        {NAV.map(({ id, key, icon: Icon }) => {
          const on = id === view;
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => (id === 'more' ? onMore() : onView(id))}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${on ? 'text-primary' : 'text-on-surface/80'}`}
            >
              <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${on ? 'bg-primary/20' : ''}`}><Icon className="h-5 w-5" aria-hidden /></span>
              {t(key)}
            </button>
          );
        })}
      </nav>
    </>
  );
}
