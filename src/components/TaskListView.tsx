'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Calendar, MessageSquare, Paperclip } from 'lucide-react';
import { fallbackAvatar } from '@/lib/avatar';
import { useNow } from '@/lib/useNow';
import { TagBadge } from './TagBadge';
import type { Task, TaskStatus } from '@/types';

const STATUS_LABEL: Record<TaskStatus, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
const STATUS_STYLE: Record<TaskStatus, string> = {
  pending: 'bg-secondary/15 text-secondary border-secondary/30',
  in_progress: 'bg-primary/15 text-primary border-primary/30',
  completed: 'bg-tertiary/15 text-tertiary border-tertiary/30',
};
const STATUS_ORDER: Record<TaskStatus, number> = { pending: 0, in_progress: 1, completed: 2 };

type SortKey = 'title' | 'status' | 'assignee' | 'due';

type Sort = { key: SortKey; dir: 1 | -1 };

function Head({ k, sort, onToggle, children }: { k: SortKey; sort: Sort; onToggle: (k: SortKey) => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onToggle(k)} className="flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary">
      {children}
      {sort.key === k && (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  );
}

export function TaskListView({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const now = useNow();
  const [sort, setSort] = useState<Sort>({ key: 'due', dir: 1 });

  const sorted = useMemo(() => {
    const value = (t: Task): string | number => {
      switch (sort.key) {
        case 'title': return t.title.toLowerCase();
        case 'status': return STATUS_ORDER[t.status];
        case 'assignee': return (t.assignee?.full_name ?? '￿').toLowerCase();
        // Sin fecha siempre al final, sea cual sea el sentido.
        case 'due': return t.due_date ? Date.parse(t.due_date) : sort.dir === 1 ? Infinity : -Infinity;
      }
    };
    return [...tasks].sort((a, b) => {
      const x = value(a), y = value(b);
      return x < y ? -sort.dir : x > y ? sort.dir : 0;
    });
  }, [tasks, sort]);

  const toggle = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  if (tasks.length === 0) {
    return <div className="hidden lg:flex flex-1 items-center justify-center text-sm text-on-surface-variant p-10">No hay tareas que coincidan con los filtros.</div>;
  }

  return (
    <div className="hidden lg:block flex-1 overflow-auto p-3 sm:p-6">
      <div className="min-w-[640px] bg-surface-container-low border border-surface-container-high rounded-xl overflow-hidden">
        <div className="grid grid-cols-[minmax(0,3fr)_120px_minmax(0,1.4fr)_150px] gap-4 px-4 py-3 border-b border-surface-container-high bg-surface-container">
          <Head k="title" sort={sort} onToggle={toggle}>Tarea</Head>
          <Head k="status" sort={sort} onToggle={toggle}>Estado</Head>
          <Head k="assignee" sort={sort} onToggle={toggle}>Responsable</Head>
          <Head k="due" sort={sort} onToggle={toggle}>Fecha límite</Head>
        </div>
        <ul>
          {sorted.map(t => {
            const overdue = t.due_date && t.status !== 'completed' && Date.parse(t.due_date) < now;
            return (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t)} className="w-full grid grid-cols-[minmax(0,3fr)_120px_minmax(0,1.4fr)_150px] gap-4 items-center px-4 py-3 text-left border-b border-surface-container-high/60 last:border-0 hover:bg-surface-container-high/50 transition-colors">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${t.status === 'completed' ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{t.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {t.tags?.map(tag => <TagBadge key={tag.id} tag={tag} />)}
                      {(t.comment_count ?? 0) > 0 && <span className="flex items-center gap-1 text-[10px] text-on-surface-variant"><MessageSquare className="w-3 h-3" />{t.comment_count}</span>}
                      {(t.attachment_count ?? 0) > 0 && <span className="flex items-center gap-1 text-[10px] text-on-surface-variant"><Paperclip className="w-3 h-3" />{t.attachment_count}</span>}
                    </div>
                  </div>
                  <span className={`justify-self-start px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {t.assigned_to ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={t.assignee?.avatar_url || fallbackAvatar(t.assigned_to)} alt="" className="w-5 h-5 rounded-full shrink-0 object-cover" />
                        <span className="text-xs text-on-surface-variant truncate">{t.assignee?.full_name}</span>
                      </>
                    ) : <span className="text-xs text-on-surface-variant/50">Sin asignar</span>}
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-error font-semibold' : 'text-on-surface-variant'}`}>
                    {t.due_date ? (<><Calendar className="w-3 h-3 shrink-0" />{new Date(t.due_date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>) : <span className="text-on-surface-variant/50">—</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
