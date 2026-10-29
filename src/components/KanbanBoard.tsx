"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Task, Profile, Tag, Team, TeamMember, BoardColumn } from '@/types';
import { Trash, Search, Plus, Tag as TagIcon, LayoutGrid, X, Users, Calendar, Settings, ChevronDown, Paperclip, List, CalendarDays } from 'lucide-react';
import { TagBadge } from './TagBadge';
import { TagSelector } from './TagSelector';
import { applyTemplate, fetchColumns, fetchUserTags, fetchTasks, createTask, updateTask, moveTask, deleteTask, uploadCover, updateProfile, fetchTeamMembers } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { BOARD_TEMPLATES, localizeTemplate } from '@/lib/templates';
import { useLang, useT } from '@/lib/i18n/client';
import { columnIdOf, columnViews, KIND_DOT, type ColumnView } from '@/lib/columns';
import { ColumnsDialog } from './ColumnsDialog';
import { 
  DndContext, 
  DragEndEvent, 
  DragStartEvent, 
  DragOverEvent,
  DragOverlay, 
  closestCorners, 
  PointerSensor, 
  TouchSensor, 
  useSensor, 
  useSensors,
  useDroppable,
  KeyboardSensor
} from '@dnd-kit/core';
import { 
  SortableContext, 
  arrayMove, 
  verticalListSortingStrategy, 
  useSortable,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NewTaskModal, type NewTaskFormData } from './NewTaskModal';
import { TaskDetailPanel } from './TaskDetailPanel';
import { ProfileModal } from './ProfileModal';
import { ThemeSwitcher } from './ThemeSwitcher';
import { TaskListView } from './TaskListView';
import { CalendarView } from './CalendarView';
import { DueSoonBell } from './DueSoonBell';
import { MobileBoard } from './mobile/MobileBoard';
import { MobileHeader, MobileNav } from './mobile/MobileChrome';
import { MobileFiltersSheet, MobileMoreSheet } from './mobile/MobileSheets';
import { MobileTaskList } from './mobile/MobileTaskList';
import { CreateTeamModal } from './CreateTeamModal';
import { TeamSettingsModal } from './TeamSettingsModal';
import { PlanBanner } from './PlanBanner';
import { OPEN_SETTINGS_EVENT } from '@/lib/upgrade';
import { fallbackAvatar, rememberName } from '@/lib/avatar';

// Draggable + Sortable wrapper
function SortableTaskCard({ task, globalAvatar, onTaskClick, onDeleteTask, onTagClick, setIsOpeningWithTagsFocused }: { task: Task, globalAvatar: string, onTaskClick: () => void, onDeleteTask: (id: string) => void, onTagClick: (tagId: string) => void, setIsOpeningWithTagsFocused: (val: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'Task', task },
  });
  
  const style = { 
    transform: CSS.Transform.toString(transform),
    transition
  };
  
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskCardRenderer task={task} globalAvatar={globalAvatar} isDragging={isDragging} onClick={onTaskClick} onDelete={onDeleteTask} onTagClick={onTagClick} setIsOpeningWithTagsFocused={setIsOpeningWithTagsFocused} />
    </div>
  );
}

// Reusable Task Renderer
function TaskCardRenderer({ task, globalAvatar, isDragging, onClick, onDelete, onTagClick, setIsOpeningWithTagsFocused }: { task: Task, globalAvatar: string, isDragging?: boolean, onClick?: () => void, onDelete?: (id: string) => void, onTagClick?: (tagId: string) => void, setIsOpeningWithTagsFocused?: (val: boolean) => void }) {
  const isOverdue = task.due_date ? new Date(task.due_date) < new Date() : false;

  return (
    <div onClick={onClick} className={`group relative bg-surface-container rounded-lg border shadow-sm flex flex-col overflow-hidden
      ${isDragging ? 'opacity-50 ring-2 ring-primary bg-surface-container-high border-primary/50' : 'border-outline-variant/15 hover:bg-surface-container-highest hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]'}
      transition-all cursor-pointer active:cursor-grabbing`}>
      
      {/* Quick Delete Overlay Button */}
      {onDelete && (
        <button 
           onClick={(e) => { 
              e.stopPropagation(); 
              if(window.confirm('¿Borrar esta tarea permanentemente?')) onDelete(task.id); 
           }}
           aria-label={`Borrar la tarea ${task.title}`}
           className="absolute top-2 right-2 w-7 h-7 rounded bg-background/80 backdrop-blur border border-outline-variant/30 flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-error hover:border-error transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 z-10 shadow-sm"
           title="Borrar rápidamente"
        >
           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      )}
      {task.image_url && (
         <div className="w-full h-32 bg-surface-container-high bg-cover bg-center shrink-0 border-b border-outline-variant/10" style={{ backgroundImage: `url('${task.image_url}')` }} />
      )}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-medium text-sm text-on-surface mb-1">{task.title}</h3>
        {task.description && (
          <p className="text-xs text-on-surface-variant line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
        )}
        <div className="flex flex-col gap-2 mt-auto pt-2">
           <div className="flex gap-1 items-center flex-wrap">
              {task.tags && task.tags.map(t => (
                <div 
                  key={t.id} 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onTagClick?.(t.id); 
                  }}
                >
                  <TagBadge tag={t} />
                </div>
              ))}
               <button 
                  onClick={(e) => {
                     e.stopPropagation();
                     // Abre el panel directamente para editar etiquetas
                     setIsOpeningWithTagsFocused?.(true);
                     onClick?.();
                  }}
                  className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-black transition-all shadow-sm"
                  title="Quick Assign Category"
               >
                 <Plus className="w-3 h-3" />
               </button>
            </div>
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               {task.due_date && (
                 <span className={`text-[10px] font-semibold flex items-center gap-1.5 shrink-0 ${isOverdue ? 'text-error' : 'text-on-surface-variant'}`}>
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   {new Date(task.due_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                 </span>
               )}
               
               {/* Activity Indicator (Comments) */}
               {(task.comment_count ?? 0) > 0 && (
                 <div className="flex items-center gap-1 text-on-surface-variant/60" title={`${task.comment_count} comentarios`}>
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                   <span className="text-[10px] font-bold">{task.comment_count}</span>
                 </div>
               )}
               
               {/* Subtareas */}
               {(task.subtask_total ?? 0) > 0 && (
                 <div className={`flex items-center gap-1 ${task.subtask_done === task.subtask_total ? 'text-tertiary' : 'text-on-surface-variant/60'}`} title={`${task.subtask_done} de ${task.subtask_total} subtareas hechas`}>
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   <span className="text-[10px] font-bold">{task.subtask_done}/{task.subtask_total}</span>
                 </div>
               )}

               {/* Attachment Indicator */}
               {(task.attachment_count ?? 0) > 0 && (
                 <div className="flex items-center gap-1 text-on-surface-variant/60" title={`${task.attachment_count} archivos adjuntos`}>
                   <Paperclip className="w-3 h-3" strokeWidth={2.5} />
                   <span className="text-[10px] font-bold">{task.attachment_count}</span>
                 </div>
               )}
             </div>
             <div title={task.assignee?.full_name || 'Unassigned'} className="w-5 h-5 shrink-0 rounded-full bg-secondary-container bg-cover bg-center ring-1 ring-background ml-auto overflow-hidden">
               <img src={task.assignee?.avatar_url || fallbackAvatar(task.assigned_to || task.user_id)} alt="Assignee" className="w-full h-full object-cover" />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

// Column container with Context
function KanbanColumn({ column, tasks, globalAvatar, onTaskClick, onDeleteTask, onTagClick, setIsOpeningWithTagsFocused }: { column: { id: string; title: string; color: string; hex?: string | null }, tasks: Task[], globalAvatar: string, onTaskClick: (t: Task) => void, onDeleteTask: (id: string) => void, onTagClick: (tagId: string) => void, setIsOpeningWithTagsFocused: (val: boolean) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id as string,
    data: { type: 'Column', column },
  });

  return (
    <div ref={setNodeRef} className={`flex flex-col w-[280px] sm:w-[320px] md:w-auto md:flex-1 shrink-0 gap-4 bg-surface-container-low rounded-xl p-4 min-h-[500px] border transition-colors ${isOver ? 'border-primary ring-1 ring-primary/20 bg-surface-container-high' : 'border-surface-container-high'}`}>
       <div className="flex items-center justify-between mb-2">
         <div className="flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full ${column.hex ? '' : column.color} shadow-[0_0_8px] shadow-current`} style={column.hex ? { backgroundColor: column.hex, color: column.hex } : undefined} />
           <h2 className="font-semibold text-on-surface uppercase tracking-wider text-xs">{column.title}</h2>
         </div>
         <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
           {tasks.length}
         </span>
       </div>
       
       <div className="flex flex-col gap-3 flex-1 min-h-[100px]">
         <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
           {tasks.map(task => (
             <SortableTaskCard key={task.id} task={task} globalAvatar={globalAvatar} onTaskClick={() => onTaskClick(task)} onDeleteTask={onDeleteTask} onTagClick={onTagClick} setIsOpeningWithTagsFocused={setIsOpeningWithTagsFocused} />
           ))}
         </SortableContext>
       </div>
    </div>
  );
}

export interface BoardInitialData {
  me: Profile;
  teams: Team[];
  teamId: string | null;
  tasks: Task[];
  members: TeamMember[];
  tags: Tag[];
  columns: BoardColumn[];
  /** Tarea que se abre al entrar (enlace de un aviso). */
  openTaskId?: string | null;
}

export function KanbanBoard({ initial }: { initial: BoardInitialData }) {
  // Caché de nombres para los avatares por iniciales (idempotente).
  rememberName(initial.me.id, initial.me.full_name);
  initial.members.forEach(m => rememberName(m.user_id, m.profile?.full_name));
  initial.tasks.forEach(t => rememberName(t.assigned_to, t.assignee?.full_name));

  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const currentUserId = initial.me.id;

  // UI State
  const [selectedTask, setSelectedTask] = useState<Task | null>(() => initial.tasks.find(t => t.id === initial.openTaskId) ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpeningWithTagsFocused, setIsOpeningWithTagsFocused] = useState(false);
  const [groupBy, setGroupBy] = useState<'status' | 'tag'>('status');
  const [view, setView] = useState<'board' | 'list' | 'calendar'>('board');
  // Solo móvil
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>(initial.columns);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const t = useT();
  const lang = useLang();
  const views = useMemo(() => columnViews(columns, t), [columns, t]);
  const activeView = views.find((v) => v.id === activeColumnId) ?? views[0];
  const searchRef = useRef<HTMLInputElement>(null);
  const [allTags, setAllTags] = useState<Tag[]>(initial.tags);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // Team & Member filtering state
  const [teams, setTeams] = useState<Team[]>(initial.teams);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(initial.teamId);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initial.members);
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);

  const [sessionProfile, setSessionProfile] = useState<Profile>(initial.me);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isTeamSettingsOpen, setIsTeamSettingsOpen] = useState(false);
  const router = useRouter();

  const currentUserRole = useMemo(() => {
    return teamMembers.find(m => m.user_id === currentUserId)?.role || 'member';
  }, [teamMembers, currentUserId]);

  const selectedTaskId = useRef<string | null>(null);
  useEffect(() => {
    selectedTaskId.current = selectedTask?.id ?? null;
  }, [selectedTask]);

  const refreshTasksWithTags = useCallback(async () => {
    if (!selectedTeamId) return;
    const fresh = await fetchTasks(selectedTeamId);
    if (!fresh) return;
    setTasks(fresh);
    // Sync selected task if open
    const open = selectedTaskId.current;
    if (open) {
      const updated = fresh.find(t => t.id === open);
      if (updated) setSelectedTask(updated);
    }
  }, [selectedTeamId]);

  const [applyingTemplate, setApplyingTemplate] = useState(false);
  // Carga una plantilla en el tablero vacío y recarga etiquetas y tareas.
  const loadTemplate = async (templateId: string) => {
    if (!selectedTeamId) return;
    setApplyingTemplate(true);
    const ok = await applyTemplate(selectedTeamId, templateId, lang);
    if (ok) {
      const [freshTags] = await Promise.all([fetchUserTags(selectedTeamId), refreshTasksWithTags()]);
      setAllTags(freshTags);
    }
    setApplyingTemplate(false);
  };

  // Cambio de equipo (manejador de evento): recarga miembros, etiquetas y tareas.
  const switchTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setFilterTagIds([]);
    setFilterAssigneeId(null);
    setSelectedTask(null);
    fetchTeamMembers(teamId).then(setTeamMembers);
    fetchUserTags(teamId).then(setAllTags);
    fetchColumns(teamId).then(setColumns);
    fetchTasks(teamId).then(fresh => fresh && setTasks(fresh));
  };

  // Tiempo real: el servidor avisa por SSE cuando alguien cambia el tablero.
  useEffect(() => {
    if (!selectedTeamId) return;
    const es = new EventSource(`/api/events?teamId=${selectedTeamId}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    es.onmessage = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        refreshTasksWithTags();
        fetchUserTags(selectedTeamId).then(setAllTags);
        fetchColumns(selectedTeamId).then(setColumns);
      }, 200);
    };
    return () => {
      clearTimeout(timer);
      es.close();
    };
  }, [selectedTeamId, refreshTasksWithTags]);

  const handleUpdateProfile = async (changes: Partial<Profile>) => {
    const updated = await updateProfile({ full_name: changes.full_name ?? undefined, avatar_url: changes.avatar_url });
    setSessionProfile(updated);
    // Refresh tasks and team members to show the new name everywhere
    refreshTasksWithTags();
    if (selectedTeamId) {
      fetchTeamMembers(selectedTeamId).then(setTeamMembers);
    }
  };

  // El diálogo de mejora del plan pide abrir el perfil (plan personal) o los ajustes del equipo (plan del equipo).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const target = (e as CustomEvent<'profile' | 'team'>).detail;
      if (target === 'profile') setIsProfileModalOpen(true);
      else if (target === 'team') setIsTeamSettingsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, []);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  const userAvatarUrl = sessionProfile?.avatar_url || fallbackAvatar(currentUserId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeTask = useMemo(() => tasks.find(t => t.id === activeId), [activeId, tasks]);

  const handleNewTask = async (data: NewTaskFormData) => {
    if (!selectedTeamId) return;

    let finalImageUrl = data.image_url;
    if (data.upload_file) {
      const uploaded = await uploadCover(data.upload_file);
      if (!uploaded) return;
      finalImageUrl = uploaded;
    }

    const id = await createTask(selectedTeamId, {
      title: data.title,
      description: data.description || null,
      due_date: data.due_date || null,
      image_url: finalImageUrl || null,
      assigned_to: data.assigned_to || null,
      tag_ids: data.tag_ids ?? [],
    });
    if (id) refreshTasksWithTags();
  };

  const handleUpdateTask = async (id: string, partial: Partial<Task & { tag_ids?: string[] }>) => {
    const { title, description, due_date, image_url, assigned_to, tag_ids } = partial;
    await updateTask(id, { title, description, due_date, image_url, assigned_to, tag_ids });
    await refreshTasksWithTags();
  };

  const handleDeleteTask = async (id: string) => {
    if (!(await deleteTask(id))) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveATask = active.data.current?.type === 'Task';
    const isOverATask = over.data.current?.type === 'Task';
    const isOverAColumn = over.data.current?.type === 'Column';

    if (!isActiveATask) return;

    // Pasa una tarea a otra columna (estado y columna a la vez, como hace el servidor al guardarla).
    const withColumn = (task: Task, columnId: string): Task => {
      const col = views.find(v => v.id === columnId);
      return col ? { ...task, column_id: col.id, status: col.kind } : task;
    };

    if (isActiveATask && isOverATask) {
      setTasks(currentTasks => {
        const activeIndex = currentTasks.findIndex(t => t.id === activeId);
        const overIndex = currentTasks.findIndex(t => t.id === overId);
        const overColumn = columnIdOf(currentTasks[overIndex], views);
        if (overColumn && columnIdOf(currentTasks[activeIndex], views) !== overColumn) {
          const newTasks = [...currentTasks];
          newTasks[activeIndex] = withColumn(newTasks[activeIndex], overColumn);
          return arrayMove(newTasks, activeIndex, overIndex);
        }
        return arrayMove(currentTasks, activeIndex, overIndex);
      });
    }

    // Solo las columnas reales (en la agrupación por etiqueta no se cambia de estado al soltar).
    if (isActiveATask && isOverAColumn && views.some(v => v.id === overId)) {
      setTasks(currentTasks => {
        const activeIndex = currentTasks.findIndex(t => t.id === activeId);
        if (columnIdOf(currentTasks[activeIndex], views) !== overId) {
          const newTasks = [...currentTasks];
          newTasks[activeIndex] = withColumn(newTasks[activeIndex], overId as string);
          return arrayMove(newTasks, activeIndex, activeIndex);
        }
        return currentTasks;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active } = event;
    const dropped = tasks.find(t => t.id === active.id);
    if (!dropped) return;
    const columnId = columnIdOf(dropped, views);
    if (!columnId) return;
    // Vecinas en la columna de destino, en el orden visual actual.
    const column = tasks.filter(t => columnIdOf(t, views) === columnId);
    const idx = column.findIndex(t => t.id === dropped.id);
    const ok = await moveTask(dropped.id, {
      columnId,
      prevId: column[idx - 1]?.id ?? null,
      nextId: column[idx + 1]?.id ?? null,
    });
    // Si el servidor lo rechaza, volvemos al estado real.
    if (!ok) refreshTasksWithTags();
  };

    // Filtros compartidos por todas las vistas
    const getFilteredTasks = (taskList: Task[]) => {
      return taskList.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (t.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesTags = filterTagIds.length === 0 || t.tags?.some(tag => filterTagIds.includes(tag.id));
        const matchesAssignee = filterAssigneeId === null || t.assigned_to === filterAssigneeId;
        
        let matchesDate = true;
        if (dateRange.start || dateRange.end) {
          if (!t.due_date) {
            matchesDate = false;
          } else {
            const d = new Date(t.due_date);
            const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            
            if (dateRange.start) {
              const startDate = new Date(dateRange.start);
              const startCmp = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
              if (taskDate < startCmp) matchesDate = false;
            }
            
            if (dateRange.end && matchesDate) {
              const endDate = new Date(dateRange.end);
              const endCmp = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
              if (taskDate > endCmp) matchesDate = false;
            }
          }
        }

        return matchesSearch && matchesTags && matchesAssignee && matchesDate;
      });
    };


  const visibleTasks = getFilteredTasks(tasks);

  const filtersCount = filterTagIds.length + (filterAssigneeId ? 1 : 0) + (dateRange.start || dateRange.end ? 1 : 0);
  const clearFilters = () => { setFilterTagIds([]); setFilterAssigneeId(null); setDateRange({ start: null, end: null }); };
  const onMobileTeamChange = (value: string) => (value === 'NEW_TEAM' ? setIsCreateTeamOpen(true) : switchTeam(value));

  // Mover desde el menú de la tarjeta (alternativa a arrastrar): va al final de la columna de destino.
  const handleMoveTo = async (task: Task, columnId: string) => {
    const col = views.find(v => v.id === columnId);
    if (!col) return;
    const last = tasks.filter(t => columnIdOf(t, views) === columnId && t.id !== task.id).at(-1);
    setTasks(prev => prev.map(x => (x.id === task.id ? { ...x, column_id: col.id, status: col.kind } : x)));
    setActiveColumnId(columnId);
    const ok = await moveTask(task.id, { columnId, prevId: last?.id ?? null, nextId: null });
    if (!ok) refreshTasksWithTags();
  };

  // Atajos: N nueva tarea · / buscar · 1 tablero · 2 lista · 3 calendario
  const anyModalOpen = isModalOpen || isTagManagerOpen || isProfileModalOpen || isCreateTeamOpen || isTeamSettingsOpen || selectedTask !== null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (anyModalOpen) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setIsModalOpen(true); }
      else if (e.key === '1') setView('board');
      else if (e.key === '2') setView('list');
      else if (e.key === '3') setView('calendar');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anyModalOpen]);

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-background">
      <MobileHeader
        teams={teams}
        teamId={selectedTeamId}
        onTeamChange={onMobileTeamChange}
        searchOpen={mobileSearchOpen}
        onSearchOpen={setMobileSearchOpen}
        query={searchQuery}
        onQuery={setSearchQuery}
        filtersCount={filtersCount}
        onFilters={() => setIsFiltersOpen(true)}
        tasks={tasks}
        userId={currentUserId}
        onOpenTask={setSelectedTask}
        avatarUrl={userAvatarUrl}
        onProfile={() => setIsProfileModalOpen(true)}
      />

      <PlanBanner teamId={selectedTeamId} isAdmin={currentUserRole === 'admin'} isPersonal={!!teams.find((t) => t.id === selectedTeamId)?.is_personal} />

      <header className="hidden lg:flex lg:flex-row items-stretch lg:items-center justify-between px-4 py-3 lg:px-6 lg:py-4 border-b border-surface-container-high backdrop-blur-md bg-surface/80 z-20 gap-4">
        {/* Top Row: Logo & Search (Mobile) / Logo (Desktop) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-primary/10 flex items-center justify-center bg-white p-1">
              <img src="/logo-mark.png" alt="Serenboard Logo" className="w-full h-full object-contain hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight text-on-surface">Serenboard</h1>
              <div className="lg:hidden flex items-center gap-2 mt-0.5">
                <select 
                  value={selectedTeamId || ''} 
                  onChange={(e) => {
                    if (e.target.value === 'NEW_TEAM') {
                      setIsCreateTeamOpen(true);
                    } else {
                      switchTeam(e.target.value);
                    }
                  }}
                  className="bg-transparent text-[10px] font-bold text-on-surface-variant focus:outline-none cursor-pointer max-w-[100px] truncate"
                >
                  {teams.map(t => <option key={t.id} value={t.id} className="bg-surface-container text-on-surface">{t.name}</option>)}
                  <option value="NEW_TEAM" className="bg-surface-container text-primary font-bold">+ Nuevo Team</option>
                </select>
                {currentUserRole === 'admin' && (
                  <button onClick={() => setIsTeamSettingsOpen(true)} className="p-1 rounded-md text-on-surface-variant hover:text-primary transition-colors">
                    <Settings className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex lg:hidden items-center gap-3">
             <DueSoonBell tasks={tasks} userId={currentUserId} onOpen={setSelectedTask} />
             <ThemeSwitcher />
             <div onClick={() => setIsProfileModalOpen(true)} className="w-8 h-8 rounded-full bg-surface-container-high border-2 border-outline-variant/30 cursor-pointer overflow-hidden shadow-sm">
                <img src={userAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
             </div>
          </div>
        </div>

        {/* Action Row: Search, Switchers, Buttons */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 group-focus-within:text-primary transition-colors" />
            <input 
               type="text" 
               ref={searchRef}
               placeholder="Buscar…  ( / )" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="bg-surface-container-low border border-outline-variant/20 text-on-surface text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 w-full lg:max-w-xs transition-all placeholder:text-on-surface-variant/40 shadow-inner"
            />
          </div>

          <div className="flex bg-surface-container border border-outline-variant/20 rounded-xl p-0.5 shrink-0 shadow-inner">
             {([
               { id: 'status', title: 'Tablero por estado (1)', icon: LayoutGrid, active: view === 'board' && groupBy === 'status', go: () => { setView('board'); setGroupBy('status'); } },
               { id: 'tag', title: 'Tablero por etiqueta', icon: TagIcon, active: view === 'board' && groupBy === 'tag', go: () => { setView('board'); setGroupBy('tag'); } },
               { id: 'list', title: 'Lista (2)', icon: List, active: view === 'list', go: () => setView('list') },
               { id: 'calendar', title: 'Calendario (3)', icon: CalendarDays, active: view === 'calendar', go: () => setView('calendar') },
             ] as const).map(v => (
               <button key={v.id} title={v.title} aria-label={v.title} aria-pressed={v.active} onClick={v.go} className={`p-1.5 sm:p-2 rounded-lg transition-all ${v.active ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}><v.icon className="w-4 h-4" /></button>
             ))}
          </div>

          <div className="flex items-center gap-2 pr-1 ml-auto lg:ml-0">
            <button onClick={() => setIsTagManagerOpen(true)} className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:py-2 bg-secondary-container text-on-secondary-container rounded-xl font-medium border border-outline-variant/20 hover:brightness-110 active:scale-95 transition-all shadow-sm" title="Categorías">
              <TagIcon className="w-4 h-4" /> 
              <span className="hidden sm:inline ml-2 text-xs uppercase tracking-wider font-bold">Tags</span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center w-10 h-10 sm:w-auto sm:px-4 sm:py-2 bg-primary text-black rounded-xl font-medium shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all" title="New Task">
              <Plus className="w-5 h-5" /> 
              <span className="hidden sm:inline ml-2 text-xs uppercase tracking-wider font-bold">New Task</span>
            </button>
          </div>
          
          {/* Desktop Only Features */}
          <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-outline-variant/20">
             <div className="flex items-center gap-3 bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/10 shadow-inner">
               <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-tighter">Equipo:</span>
                  <select 
                    value={selectedTeamId || ''} 
                    onChange={(e) => {
                      if (e.target.value === 'NEW_TEAM') {
                        setIsCreateTeamOpen(true);
                      } else {
                        switchTeam(e.target.value);
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-on-surface focus:outline-none cursor-pointer pr-4"
                  >
                    {teams.map(t => <option key={t.id} value={t.id} className="bg-surface-container text-on-surface">{t.name}</option>)}
                    <option value="NEW_TEAM" className="bg-surface-container text-primary font-bold">+ Nuevo Equipo</option>
                  </select>
               </div>
               
               {currentUserRole === 'admin' && (
                 <button 
                  onClick={() => setIsTeamSettingsOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-primary/20 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                  title="Gestionar Miembros"
                 >
                   <Users className="w-4 h-4" />
                 </button>
               )}
             </div>
             <DueSoonBell tasks={tasks} userId={currentUserId} onOpen={setSelectedTask} />
             <ThemeSwitcher />
             <div onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 rounded-full bg-surface-container-high border-2 border-outline-variant/30 cursor-pointer overflow-hidden shadow-md active:scale-90 transition-transform">
               <img src={userAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
             </div>
          </div>
        </div>
      </header>

      {/* Advanced Filters Toolbar */}
      <div className="hidden lg:flex px-4 lg:px-6 py-3 bg-surface-container-low border-b border-outline-variant/10 items-center gap-4 sm:gap-6 shrink-0 shadow-sm relative z-30">
        {/* Assignee Filter */}
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="text-[10px] font-bold uppercase text-on-surface-variant shrink-0 hidden sm:block">Responsable:</span>
          <Users className="w-4 h-4 text-on-surface-variant sm:hidden" />
          <div className="flex items-center -space-x-2">
            <button 
              onClick={() => setFilterAssigneeId(null)}
              className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold ${filterAssigneeId === null ? 'border-primary bg-primary text-black z-10 scale-110 shadow-md' : 'border-background bg-surface-container-high text-on-surface-variant hover:z-10 hover:scale-105'}`}
            >
              All
            </button>
            {teamMembers.map(m => (
              <button 
                key={m.id}
                onClick={() => setFilterAssigneeId(m.user_id)}
                title={m.profile?.full_name || m.profile?.email}
                className={`w-7 h-7 rounded-full border-2 transition-all overflow-hidden ${filterAssigneeId === m.user_id ? 'border-primary ring-2 ring-primary/20 z-10 scale-110 shadow-md' : 'border-background hover:z-10 hover:scale-105'}`}
              >
                <img src={m.profile?.avatar_url || fallbackAvatar(m.user_id)} alt="Member" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter Range Picker */}
        <div className="relative">
          <button 
            onClick={() => setIsDateRangeOpen(!isDateRangeOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${dateRange.start || dateRange.end ? 'bg-primary/20 border-primary text-primary shadow-sm' : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:text-on-surface'}`}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden xs:inline">
              {(dateRange.start || dateRange.end) 
                ? `${dateRange.start ? new Date(dateRange.start).toLocaleDateString() : '...'} - ${dateRange.end ? new Date(dateRange.end).toLocaleDateString() : '...'}` 
                : 'Filtrar Fecha'}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isDateRangeOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDateRangeOpen && (
            <div className="absolute top-full left-0 mt-2 z-50 p-4 bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl min-w-[280px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-tighter">Rango de Fecha</h3>
                {(dateRange.start || dateRange.end) && (
                  <button 
                    onClick={() => {
                      setDateRange({ start: null, end: null });
                      setIsDateRangeOpen(false);
                    }}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    LIMPIAR
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-on-surface-variant uppercase ml-1">Desde:</label>
                  <input 
                    type="date" 
                    value={dateRange.start || ''}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value || null }))}
                    className="bg-surface-container-low border border-outline-variant/20 text-on-surface text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 w-full transition-all"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-on-surface-variant uppercase ml-1">Hasta:</label>
                  <input 
                    type="date" 
                    value={dateRange.end || ''}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value || null }))}
                    className="bg-surface-container-low border border-outline-variant/20 text-on-surface text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 w-full transition-all"
                  />
                </div>

                <button 
                  onClick={() => setIsDateRangeOpen(false)}
                  className="w-full py-2 bg-primary text-black font-bold text-[10px] uppercase rounded-lg shadow-lg shadow-primary/20 mt-2"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-3 lg:pl-6 lg:border-l lg:border-outline-variant/20 flex-1 min-w-0 overflow-visible">
            {/* Desktop Version: Horizontal Scroll */}
            <div className="hidden lg:flex items-center gap-3 flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase text-on-surface-variant shrink-0">Categoría:</span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1">
                {allTags.map(tag => {
                  const isActive = filterTagIds.includes(tag.id);
                  return (
                    <button key={tag.id} onClick={() => setFilterTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])} className={`px-2.5 py-1.5 rounded-full text-[9px] font-semibold transition-all flex items-center gap-1.5 border whitespace-nowrap ${isActive ? 'scale-105 shadow-md' : 'bg-surface-container-high text-on-surface-variant'}`} style={{ backgroundColor: isActive ? tag.color : undefined, color: isActive ? '#000' : undefined }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
              {filterTagIds.length > 0 && <button onClick={() => setFilterTagIds([])} className="ml-2 text-[10px] font-bold text-primary hover:underline uppercase shrink-0">Limpiar</button>}
            </div>

            {/* Mobile Version: Dropdown */}
            <div className="lg:hidden relative">
              <button 
                onClick={() => setIsTagFilterOpen(!isTagFilterOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${filterTagIds.length > 0 ? 'bg-primary/20 border-primary text-primary shadow-sm' : 'bg-surface-container-high border-outline-variant/10 text-on-surface-variant hover:text-on-surface'}`}
              >
                <TagIcon className="w-4 h-4" />
                <span>Categorías</span>
                {filterTagIds.length > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-black text-[9px] font-black">
                    {filterTagIds.length}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${isTagFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {isTagFilterOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 p-4 bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl min-w-[200px] max-h-[300px] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-on-surface uppercase tracking-tighter">Filtrar por Etiqueta</h3>
                    {filterTagIds.length > 0 && (
                      <button onClick={() => setFilterTagIds([])} className="text-[10px] font-bold text-primary hover:underline">LIMPIAR</button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {allTags.map(tag => {
                      const isActive = filterTagIds.includes(tag.id);
                      return (
                        <button 
                          key={tag.id} 
                          onClick={() => setFilterTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-left"
                        >
                          <div className={`w-3 h-3 rounded-full border border-white/20 ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container' : ''}`} style={{ backgroundColor: tag.color }} />
                          <span className={`text-[11px] font-semibold ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>{tag.name}</span>
                          {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => setIsTagFilterOpen(false)}
                    className="w-full py-2 bg-primary text-black font-bold text-[10px] uppercase rounded-lg mt-4"
                  >
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {tasks.length === 0 && (
        <section aria-label={t('board.guide.region')} className="mx-4 mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 lg:mx-6">
          <h2 className="text-base font-bold text-on-surface">{t('board.guide.title')}</h2>
          <ol className="mt-3 grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3">
            <li><span className="font-bold text-primary">1.</span> {t('board.guide.step1')}</li>
            <li><span className="font-bold text-primary">2.</span> {t('board.guide.step2')}</li>
            <li><span className="font-bold text-primary">3.</span> {t('board.guide.step3')}</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => setIsModalOpen(true)} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold uppercase tracking-widest text-black transition-all hover:brightness-110 active:scale-95">
              {t('board.guide.create')}
            </button>
            <span className="text-xs text-on-surface-variant">{t('board.guide.orTemplate')}</span>
            {BOARD_TEMPLATES.map((raw) => { const tpl = localizeTemplate(raw, lang); return (
              <button
                key={tpl.id}
                onClick={() => void loadTemplate(tpl.id)}
                disabled={applyingTemplate}
                title={tpl.description}
                className="min-h-11 rounded-xl border border-outline-variant/40 px-3 py-2 text-xs font-bold text-on-surface transition-all hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {tpl.name}
              </button>
            ); })}
          </div>
        </section>
      )}

      {view === 'list' ? (
        <>
          <TaskListView tasks={visibleTasks} columns={views} onOpen={setSelectedTask} />
          <MobileTaskList tasks={visibleTasks} columns={views} userId={currentUserId} role={currentUserRole} onOpen={setSelectedTask} onMove={handleMoveTo} onDelete={(t) => handleDeleteTask(t.id)} />
        </>
      ) : view === 'calendar' ? (
        <CalendarView tasks={visibleTasks} onOpen={setSelectedTask} />
      ) : (
        <>
          <div className="hidden min-h-0 flex-1 flex-col lg:flex">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-6 flex gap-6 items-start">
          {(() => {
            if (groupBy === 'status') {
              return [...views.map(col => {
                const filteredTasks = getFilteredTasks(tasks.filter(t => columnIdOf(t, views) === col.id));
                return (
                  <KanbanColumn
                    key={col.id}
                    column={{ id: col.id, title: col.label, color: KIND_DOT[col.kind], hex: col.hex }}  
                    tasks={filteredTasks} 
                    globalAvatar={userAvatarUrl} 
                    onTaskClick={setSelectedTask} 
                    onDeleteTask={handleDeleteTask} 
                    onTagClick={(tagId) => setFilterTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])} 
                    setIsOpeningWithTagsFocused={setIsOpeningWithTagsFocused}
                  />
                );
              }),
              <button
                key="manage-columns"
                type="button"
                onClick={() => setIsColumnsOpen(true)}
                className="flex min-h-[120px] w-[200px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/40 p-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-5 w-5" aria-hidden />
                {t('columns.manage')}
              </button>];
            } else {
              return (
                <>
                  {allTags.map(tag => {
                    const tagTasks = tasks.filter(t => t.tags?.some(tagObj => tagObj.id === tag.id));
                    const filteredTasks = getFilteredTasks(tagTasks);
                    return (
                      <KanbanColumn 
                        key={tag.id} 
                        column={{ id: tag.id, title: tag.name, color: '' }} 
                        tasks={filteredTasks} 
                        globalAvatar={userAvatarUrl} 
                        onTaskClick={setSelectedTask} 
                        onDeleteTask={handleDeleteTask} 
                        onTagClick={(tagId) => setFilterTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])} 
                        setIsOpeningWithTagsFocused={setIsOpeningWithTagsFocused} 
                      />
                    );
                  })}
                  {(() => {
                    const uncategorizedTasks = tasks.filter(t => !t.tags || t.tags.length === 0);
                    const filteredTasks = getFilteredTasks(uncategorizedTasks);
                    return (
                      <KanbanColumn 
                        column={{ id: 'none', title: 'No Tag', color: 'bg-outline-variant/30' }} 
                        tasks={filteredTasks} 
                        globalAvatar={userAvatarUrl} 
                        onTaskClick={setSelectedTask} 
                        onDeleteTask={handleDeleteTask} 
                        onTagClick={(tagId) => setFilterTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])} 
                        setIsOpeningWithTagsFocused={setIsOpeningWithTagsFocused} 
                      />
                    );
                  })()}
                </>
              );
            }
          })()}
        </div>
        <DragOverlay>
           {activeTask ? (<div className="rotate-2 scale-105 opacity-90"><TaskCardRenderer task={activeTask} globalAvatar={userAvatarUrl} /></div>) : null}
        </DragOverlay>
      </DndContext>
          </div>
          <MobileBoard
            tasks={visibleTasks}
            groupBy={groupBy}
            allTags={allTags}
            columns={views}
            activeColumnId={activeView?.id ?? null}
            onActiveColumn={setActiveColumnId}
            userId={currentUserId}
            role={currentUserRole}
            onOpen={setSelectedTask}
            onMove={handleMoveTo}
            onDelete={(t) => handleDeleteTask(t.id)}
          />
        </>
      )}

      <NewTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleNewTask} 
        teamMembers={teamMembers}
        teamId={selectedTeamId}
      />
      
      {isTagManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={() => setIsTagManagerOpen(false)} />
            <div className="relative w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant/30 shadow-2xl">
              <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between"><h2 className="text-lg font-bold text-on-surface">Categorías</h2><button onClick={() => setIsTagManagerOpen(false)}><X className="w-5 h-5" /></button></div>
              <div className="p-6">
                 <TagSelector 
                   selectedTagIds={[]} 
                   teamId={selectedTeamId}
                   onChange={async () => {
                     const tags = selectedTeamId ? await fetchUserTags(selectedTeamId) : [];
                     setAllTags(tags);
                     refreshTasksWithTags();
                   }} 
                 />
              </div>
              <div className="p-4 flex justify-end"><button onClick={() => setIsTagManagerOpen(false)} className="px-6 py-2 bg-primary text-black font-bold uppercase text-[10px] rounded-lg">Listo</button></div>
            </div>
        </div>
      )}

      <ColumnsDialog
        isOpen={isColumnsOpen}
        onClose={() => setIsColumnsOpen(false)}
        teamId={selectedTeamId}
        columns={columns}
        tasks={tasks}
        canManage={currentUserRole === 'admin' || currentUserRole === 'product_owner'}
        onChanged={async () => {
          if (!selectedTeamId) return;
          const [fresh] = await Promise.all([fetchColumns(selectedTeamId), refreshTasksWithTags()]);
          setColumns(fresh);
        }}
      />

      <ProfileModal isOpen={isProfileModalOpen} profile={sessionProfile} onClose={() => setIsProfileModalOpen(false)} onUpdateProfile={handleUpdateProfile} onLogout={handleLogout} />
      <TaskDetailPanel 
        key={selectedTask?.id || 'none'} 
        isOpen={selectedTask !== null} 
        task={selectedTask} 
        autoEditTags={isOpeningWithTagsFocused} 
        onClose={() => { setSelectedTask(null); setIsOpeningWithTagsFocused(false); }} 
        onUpdate={handleUpdateTask} 
        onDelete={handleDeleteTask}
        onRefresh={refreshTasksWithTags}
        columns={views}
        onMoveToColumn={handleMoveTo}
        teamMembers={teamMembers}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        teamId={selectedTeamId}
      />

      <CreateTeamModal 
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        onTeamCreated={(team) => {
          setTeams(prev => [...prev, team]);
          switchTeam(team.id);
        }}
      />

      <TeamSettingsModal 
        isOpen={isTeamSettingsOpen}
        team={teams.find(t => t.id === selectedTeamId) || null}
        onClose={() => setIsTeamSettingsOpen(false)}
        currentUserRole={currentUserRole}
        onMembersUpdate={setTeamMembers}
      />

      <MobileNav view={view} onView={setView} onMore={() => setIsMoreOpen(true)} onNewTask={() => setIsModalOpen(true)} />
      <MobileFiltersSheet
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        groupBy={groupBy}
        onGroupBy={setGroupBy}
        showGroupBy={view === 'board'}
        members={teamMembers}
        assigneeId={filterAssigneeId}
        onAssignee={setFilterAssigneeId}
        dateRange={dateRange}
        onDateRange={setDateRange}
        tags={allTags}
        tagIds={filterTagIds}
        onTagIds={setFilterTagIds}
        activeCount={filtersCount}
        onClear={clearFilters}
      />
      <MobileMoreSheet
        open={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        isAdmin={currentUserRole === 'admin'}
        teamName={teams.find(t => t.id === selectedTeamId)?.name ?? null}
        onTeamSettings={() => setIsTeamSettingsOpen(true)}
        onNewTeam={() => setIsCreateTeamOpen(true)}
        onTags={() => setIsTagManagerOpen(true)}
        onProfile={() => setIsProfileModalOpen(true)}
        onLogout={handleLogout}
      />
    </div>
  );
}
