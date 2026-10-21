'use client'

import { useState, useEffect } from 'react'
import { Task, Tag, TeamMember, TeamRole, TaskComment } from '@/types'
import { TagSelector } from './TagSelector'
import { TagBadge } from './TagBadge'
import { Plus, User, ShieldAlert, MessageSquare, Send, Reply, Trash2, Calendar, Paperclip, FileText, X, Download, AlertCircle, Check, Loader2 } from 'lucide-react'
import { fetchTaskComments, createComment, deleteComment, uploadAttachment, getAttachmentsByTask, deleteAttachment, attachmentUrl } from '@/lib/api'
import { toast } from '@/lib/toast'
import { Attachment } from '@/types'
import { fallbackAvatar } from '@/lib/avatar';

export function TaskDetailPanel({ 
   isOpen, 
   task, 
   autoEditTags = false,
   onClose, 
   onUpdate, 
   onDelete,
   onRefresh,
   teamMembers = [],
   currentUserRole = 'member',
   currentUserId = '',
   teamId = null
}: { 
   isOpen: boolean, 
   task: Task | null, 
   autoEditTags?: boolean,
   onClose: () => void, 
   onUpdate: (id: string, partial: Partial<Task> & { tag_ids?: string[] }) => Promise<void>, 
   onDelete: (id: string) => Promise<void>,
   onRefresh?: () => void,
   teamMembers?: TeamMember[],
   currentUserRole?: TeamRole,
   currentUserId?: string,
   teamId?: string | null
}) {
   const [isEditing, setIsEditing] = useState(false);
   const [editedTitle, setEditedTitle] = useState('');
   const [editedDesc, setEditedDesc] = useState('');
   const [editedTagIds, setEditedTagIds] = useState<string[]>([]);
   const [editedAssignedTo, setEditedAssignedTo] = useState<string>('');
   const [isSubmitting, setIsSubmitting] = useState(false);
   
   // Estados para comentarios
   const [comments, setComments] = useState<TaskComment[]>([]);
   const [newComment, setNewComment] = useState('');
   const [replyingTo, setReplyingTo] = useState<TaskComment | null>(null);
   const [isLoadingComments, setIsLoadingComments] = useState(false);

   // Estados para adjuntos
   const [taskAttachments, setTaskAttachments] = useState<Attachment[]>([]);
   const [isUploading, setIsUploading] = useState(false);
   const [commentFile, setCommentFile] = useState<File | null>(null);

   // RBAC: Roles higher than member OR creator can edit/delete
   const canManage = currentUserRole === 'admin' || currentUserRole === 'product_owner' || task?.user_id === currentUserId;

   useEffect(() => {
      if (task) {
         setEditedTitle(task.title);
         setEditedDesc(task.description || '');
         setEditedTagIds(task.tags?.map(t => t.id) || []);
         setEditedAssignedTo(task.assigned_to || '');
         
         // Si venimos de un "Quick Add", activamos edición de inmediato
         if (autoEditTags) {
            setIsEditing(true);
         } else {
            setIsEditing(false);
         }

         loadComments();
         loadAttachments();
      }
   }, [task, autoEditTags]);

   const loadComments = async () => {
      if (!task) return;
      setIsLoadingComments(true);
      const data = await fetchTaskComments(task.id);
      setComments(data);
      setIsLoadingComments(false);
   }

   const loadAttachments = async () => {
     if (!task) return;
     const data = await getAttachmentsByTask(task.id);
     setTaskAttachments(data);
   }

   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !task) return;

     setIsUploading(true);
     try {
       await uploadAttachment(file, { taskId: task.id });
       loadAttachments();
       onRefresh?.();
     } catch (err: unknown) {
       toast.error(err instanceof Error ? err.message : 'Error al subir el archivo');
     } finally {
       setIsUploading(false);
       if (e.target) e.target.value = '';
     }
   }

   const handleDeleteAttachment = async (att: Attachment) => {
     if (window.confirm('¿Eliminar este archivo permanentemente?')) {
       await deleteAttachment(att);
       loadAttachments();
       loadComments(); // Refresh comments in case it was a comment attachment
       onRefresh?.();
     }
   }

   const handleDownload = (att: Attachment) => {
     const link = document.createElement('a');
     link.href = attachmentUrl(att);
     link.download = att.file_name;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
   }

   if (!task) return null;

   const handleSave = async () => {
      setIsSubmitting(true);
      await onUpdate(task.id, { 
        title: editedTitle.trim() || 'Sin Título', 
        description: editedDesc,
        tag_ids: editedTagIds,
        assigned_to: editedAssignedTo || null
      });
      setIsSubmitting(false);
      setIsEditing(false);
   }

   const handleDelete = async () => {
      if (window.confirm("¿Estás súper seguro de que quieres eliminar esta tarea permanentemente? (Esta acción no se puede deshacer)")) {
         setIsSubmitting(true);
         await onDelete(task.id);
         setIsSubmitting(false);
      }
   }

   const handleAddComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() && !commentFile) return;

      setIsSubmitting(true);
      const comment = await createComment(
         task.id,
         newComment,
         replyingTo?.id || null
      );

      if (comment && commentFile) {
         try {
           await uploadAttachment(commentFile, { commentId: comment.id });
         } catch (err: unknown) {
           toast.error(err instanceof Error ? err.message : 'Error al subir el archivo del comentario');
         }
      }

      if (comment) {
         setNewComment('');
         setCommentFile(null);
         setReplyingTo(null);
         loadComments(); // Refresh to see the new comment with its attachment
         onRefresh?.();
      }
      setIsSubmitting(false);
   }

   const handleDeleteComment = async (id: string) => {
      if (window.confirm("¿Eliminar comentario?")) {
         const success = await deleteComment(id);
         if (success) {
            loadComments();
            onRefresh?.();
         }
      }
   }

   return (
    <>
      <div 
        className={`fixed inset-0 z-40 bg-background/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />
      
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
         
         <div className={`w-full max-w-2xl h-dvh max-h-dvh lg:h-auto lg:max-h-[90vh] bg-surface-container-low rounded-none lg:rounded-3xl border border-surface-container-high shadow-[0_20px_60px_rgba(0,0,0,0.6)] transform transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex flex-col overflow-hidden ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}`}>
         
         {/* Botonera superior flotante */}
         <div className="absolute top-[max(1rem,env(safe-area-inset-top))] lg:top-4 right-4 z-20 flex items-center gap-2">
            {isEditing && (
              <button 
                onClick={handleSave} 
                disabled={isSubmitting} 
                className="px-4 h-11 lg:h-8 rounded-full bg-primary text-black flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20 text-[10px] font-bold uppercase tracking-wider animate-in fade-in zoom-in duration-300"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Check className="w-4 h-4" />}
                <span className="hidden sm:inline">Guardar Cambios</span>
              </button>
            )}
            {canManage && (
              <button onClick={handleDelete} title="Eliminar Tarea" className="w-11 h-11 lg:w-8 lg:h-8 rounded-full bg-error/10 text-error flex items-center justify-center hover:bg-error hover:text-white transition-colors shadow-sm">
                 <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} aria-label="Cerrar" className="w-11 h-11 lg:w-8 lg:h-8 rounded-full bg-background/50 backdrop-blur-md text-on-surface-variant flex items-center justify-center border border-outline-variant/20 hover:text-on-surface hover:bg-surface-container-highest transition-colors shadow-sm">
               <X className="w-4 h-4" />
            </button>
         </div>

         {/* Portada Header */}
         {task.image_url ? (
            <div className="w-full h-48 shrink-0 bg-surface-container-high bg-cover bg-center border-b border-surface-container-highest relative" style={{ backgroundImage: `url('${task.image_url}')` }}>
               <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            </div>
         ) : (
            <div className="w-full h-24 shrink-0 bg-gradient-to-br from-surface-container to-surface-container-high border-b border-surface-container-highest flex items-end justify-start px-6 pb-4">
              <span className="text-[10px] px-3 py-1 rounded-full bg-surface-bright text-on-surface border border-outline-variant/20 uppercase font-bold tracking-widest shadow-sm">
                 {task.status.replace('_', ' ')}
              </span>
            </div>
         )}
         
         {/* Scrollable Content */}
         <div className={`flex-1 overflow-y-auto p-6 flex flex-col gap-6 ${task.image_url ? '-mt-12 relative z-10' : ''}`}>
            
            {/* Status Mover Pill (Especial móvil: Mover sin Drag) */}
            <div className="flex bg-surface-container border border-outline-variant/20 rounded-xl p-1 shadow-inner mt-2 shrink-0 relative z-20">
               {(['pending', 'in_progress', 'completed'] as const).map(s => (
                  <button 
                     key={s}
                     disabled={isSubmitting}
                     onClick={async () => {
                        if (task.status !== s) {
                           setIsSubmitting(true);
                           await onUpdate(task.id, { status: s });
                           setIsSubmitting(false);
                        }
                     }}
                     className={`flex-1 py-2 max-lg:min-h-11 max-lg:text-xs rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${task.status === s ? 'bg-primary text-black shadow-lg scale-100 ring-2 ring-primary/50' : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'}`}
                  >
                     {s.replace('_', ' ')}
                  </button>
               ))}
            </div>

            {/* Responsable Selector */}
            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <h3 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">Responsable</h3>
                  {isEditing && !canManage && (
                    <span className="text-[9px] text-error font-bold uppercase tracking-tighter flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Solo Admin / Propietario
                    </span>
                  )}
               </div>
               
               {isEditing ? (
                  <div className={`flex items-center gap-3 bg-surface-container rounded-lg border border-outline-variant/30 px-3 py-1.5 shadow-inner ${!canManage ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-outline-variant/20 bg-surface-container-high">
                      <img 
                        src={teamMembers.find(m => m.user_id === editedAssignedTo)?.profile?.avatar_url || fallbackAvatar(editedAssignedTo || 'none')} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <select 
                      value={editedAssignedTo} 
                      onChange={(e) => setEditedAssignedTo(e.target.value)} 
                      disabled={!canManage}
                      className="flex-1 bg-transparent text-sm text-on-surface focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-surface-container">Sin asignar</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.user_id} className="bg-surface-container">
                          {m.profile?.full_name || m.profile?.email} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
               ) : (
                  <div onClick={() => canManage && setIsEditing(true)} className={`flex items-center gap-3 bg-surface-container-low p-3 rounded-xl border border-outline-variant/10 shadow-sm ${canManage ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''}`}>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/20 bg-surface-container-high">
                      <img 
                        src={task.assignee?.avatar_url || fallbackAvatar(task.assigned_to || 'none')} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Asignado a</p>
                      <p className="font-semibold text-on-surface">{task.assignee?.full_name || 'Sin asignar'}</p>
                    </div>
                    {task.assignee?.full_name === 'Sin asignar' && canManage && (
                       <User className="ml-auto w-4 h-4 text-on-surface-variant/40" />
                    )}
                  </div>
               )}
            </div>
            
            <div className="flex flex-wrap gap-2">
               <span className="text-[10px] px-3 py-1 rounded-full bg-primary/20 backdrop-blur-md text-primary uppercase font-bold tracking-widest border border-primary/20 shadow-sm">
                  {task.status.replace('_', ' ')}
               </span>
               {task.tags && task.tags.map(t => (
                  <TagBadge key={t.id} tag={t} />
               ))}
            </div>

            <div className="group relative">
              {isEditing ? (
                 <input autoFocus value={editedTitle} onChange={e => setEditedTitle(e.target.value)} className="text-2xl font-bold bg-transparent border-b border-primary/50 focus:outline-none text-on-surface w-full pb-1 focus:ring-0" />
              ) : (
                 <h2 onClick={() => isEditing && setIsEditing(true)} className="text-2xl font-bold text-on-surface leading-tight break-words border-b border-transparent pb-1 transition-colors">
                   {task.title}
                 </h2>
              )}
            </div>

            {task.due_date && (
               <div className="flex items-center gap-3 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl border border-outline-variant/10 shadow-inner">
                 <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center text-error border border-error/20">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 </div>
                 <div>
                   <p className="text-[10px] max-lg:text-xs uppercase font-bold tracking-widest text-error/80 max-lg:text-error">Plazo / Límite</p>
                   <p className="font-semibold text-on-surface">{new Date(task.due_date).toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                 </div>
               </div>
            )}

            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <h3 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">Etiquetas / Categorías</h3>
                  {!isEditing && canManage && (
                     <button onClick={() => setIsEditing(true)} className="text-[10px] max-lg:text-xs max-lg:min-h-11 max-lg:px-2 text-primary hover:underline font-bold uppercase tracking-wider">Gestionar</button>
                  )}
               </div>
               
               {isEditing ? (
                  <TagSelector selectedTagIds={editedTagIds} onChange={setEditedTagIds} teamId={teamId} />
               ) : (
                  <div 
                     onClick={() => canManage && setIsEditing(true)} 
                     className={`flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/30 transition-all items-center ${canManage ? 'hover:border-primary/50 cursor-pointer' : ''}`}
                  >
                     {task.tags && task.tags.length > 0 ? (
                        task.tags.map(t => <TagBadge key={t.id} tag={t} />)
                     ) : (
                        <div className="flex items-center gap-2 text-[10px] max-lg:text-sm text-on-surface-variant/60 max-lg:text-on-surface-variant font-medium px-2">
                           {canManage && <Plus className="w-3 h-3 text-primary" />}
                           <span>{canManage ? 'Añadir etiquetas o categorías...' : 'Sin etiquetas'}</span>
                        </div>
                     )}
                  </div>
               )}
            </div>

            <div className="flex flex-col gap-2 mt-1">
               <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <h3 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">Descripción Larga</h3>
                  {!isEditing && canManage && (
                     <button onClick={() => setIsEditing(true)} className="text-[10px] max-lg:text-xs max-lg:min-h-11 max-lg:px-2 text-primary hover:underline font-bold uppercase tracking-wider">Editar Texto</button>
                  )}
               </div>
               
               {isEditing ? (
                  <textarea value={editedDesc} onChange={e => setEditedDesc(e.target.value)} rows={8} className="w-full p-4 bg-surface-container rounded-xl border border-primary/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-on-surface resize-none leading-relaxed shadow-inner" placeholder="Escribe especificaciones, enlaces, notas..." />
               ) : (
                  <div onClick={() => canManage && setIsEditing(true)} className={`text-sm text-on-surface/80 leading-relaxed whitespace-pre-wrap min-h-[150px] bg-surface-container-lowest p-3 rounded-xl border border-transparent transition-colors ${canManage ? 'cursor-text hover:border-outline-variant/20' : ''}`}>
                     {task.description || <span className="text-on-surface-variant/50 italic">Sin descripción general.</span>}
                  </div>
               )}
            </div>

            {/* SECCIÓN DE ADJUNTOS (TASK) */}
            <div className="flex flex-col gap-2">
               <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <h3 className="text-xs uppercase font-bold text-on-surface-variant tracking-wider">Archivos Adjuntos</h3>
                  <label className={`text-[10px] text-primary hover:underline font-bold uppercase tracking-wider cursor-pointer ${isUploading ? 'opacity-50' : ''}`}>
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    {isUploading ? 'Subiendo...' : 'Añadir Archivo'}
                  </label>
               </div>
               
               {taskAttachments.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                   {taskAttachments.map(att => (
                     <div key={att.id} className="group/att flex items-center justify-between bg-surface-container p-2 rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all">
                       <div className="flex items-center gap-2 overflow-hidden">
                         <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
                           <FileText className="w-4 h-4" />
                         </div>
                         <div className="overflow-hidden">
                           <p className="text-[11px] font-bold text-on-surface truncate pr-2" title={att.file_name}>{att.file_name}</p>
                           <p className="text-[9px] text-on-surface-variant/60">{(att.size / 1024 / 1024).toFixed(2)} MB</p>
                         </div>
                       </div>
                       <div className="flex items-center gap-1 opacity-0 group-hover/att:opacity-100 transition-opacity">
                         <button onClick={() => handleDownload(att)} className="p-1.5 hover:bg-surface-container-highest rounded-lg text-primary transition-colors">
                           <Download className="w-3.5 h-3.5" />
                         </button>
                         {canManage && (
                           <button onClick={() => handleDeleteAttachment(att)} className="p-1.5 hover:bg-error/10 rounded-lg text-error/60 hover:text-error transition-colors">
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-outline-variant/20 rounded-2xl bg-surface-container-lowest/30">
                   <Paperclip className="w-6 h-6 text-on-surface-variant/20 mb-2" />
                   <p className="text-[10px] text-on-surface-variant/50 font-medium">No hay archivos en esta tarea</p>
                 </div>
               )}
            </div>

            {/* SECCIÓN DE COMENTARIOS (HILOS) */}
            <div className="flex flex-col gap-4 mt-4 border-t border-outline-variant/10 pt-6">
               <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="text-sm uppercase font-bold text-on-surface tracking-wider">Actividad y Comentarios</h3>
               </div>

               {/* Lista de Comentarios */}
               <div className="flex flex-col gap-6">
                  {isLoadingComments ? (
                     <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                     </div>
                  ) : comments.length > 0 ? (
                     comments.map(comment => (
                        <div key={comment.id} className="flex flex-col gap-3">
                           {/* Comentario Principal */}
                           <CommentItem 
                              comment={comment} 
                              onReply={() => setReplyingTo(comment)}
                              onDelete={() => handleDeleteComment(comment.id)}
                              currentUserId={currentUserId}
                              canManage={canManage}
                              onDeleteAttachment={handleDeleteAttachment}
                           />
                           
                           {/* Respuestas (Anidadas) */}
                           {comment.replies && comment.replies.length > 0 && (
                              <div className="ml-10 flex flex-col gap-4 border-l-2 border-outline-variant/10 pl-4">
                                 {comment.replies.map(reply => (
                                    <CommentItem 
                                       key={reply.id} 
                                       comment={reply}
                                       onDelete={() => handleDeleteComment(reply.id)}
                                       currentUserId={currentUserId}
                                       canManage={canManage}
                                       onDeleteAttachment={handleDeleteAttachment}
                                       isReply
                                    />
                                 ))}
                              </div>
                           )}
                        </div>
                     ))
                  ) : (
                     <p className="text-xs text-on-surface-variant/50 italic py-4">No hay comentarios aún. ¡Sé el primero en decir algo!</p>
                  )}
               </div>

               {/* Input de Nuevo Comentario */}
               <form onSubmit={handleAddComment} className="flex flex-col gap-3 bg-surface-container p-4 rounded-2xl border border-outline-variant/20 mt-2">
                  {replyingTo && (
                     <div className="flex items-center justify-between bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                        <p className="text-[10px] text-primary font-bold uppercase flex items-center gap-2">
                           <Reply className="w-3 h-3" /> Respondiendo a {replyingTo.profile?.full_name || replyingTo.profile?.email}
                        </p>
                        <button type="button" onClick={() => setReplyingTo(null)} className="text-[10px] text-on-surface-variant hover:text-error transition-colors">✕ Cancelar</button>
                     </div>
                  )}
                  <div className="flex gap-3">
                     <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-outline-variant/20">
                        <img 
                           src={teamMembers.find(m => m.user_id === currentUserId)?.profile?.avatar_url || fallbackAvatar(currentUserId)} 
                           alt="Tú" 
                           className="w-full h-full object-cover" 
                        />
                     </div>
                     <textarea 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escribe un comentario..."
                        rows={2}
                        className="flex-1 max-lg:min-h-12 max-lg:text-base bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none resize-none"
                     />
                  </div>

                  {/* Adjunto en Comentario */}
                  {commentFile && (
                    <div className="ml-11 flex items-center justify-between bg-surface-container-highest/50 p-2 rounded-xl border border-outline-variant/20 animate-in fade-in slide-in-from-left-2 mb-2">
                       <div className="flex items-center gap-2">
                         <FileText className="w-4 h-4 text-primary" />
                         <p className="text-[11px] font-bold text-on-surface truncate max-w-[200px]">{commentFile.name}</p>
                       </div>
                       <button type="button" onClick={() => setCommentFile(null)} className="p-1 hover:bg-error/10 text-error rounded-full transition-colors">
                         <X className="w-3.5 h-3.5" />
                       </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/10">
                     <div className="flex items-center gap-1">
                        <label className="p-2 hover:bg-surface-container-highest rounded-xl text-on-surface-variant hover:text-primary transition-colors cursor-pointer" title="Adjuntar archivo (máx 10 MB)">
                          <input type="file" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 10 * 1024 * 1024) {
                                toast.error('El archivo supera los 10 MB');
                                if (e.target) e.target.value = '';
                                return;
                              }
                              setCommentFile(file);
                            }
                          }} />
                          <Paperclip className="w-4 h-4" />
                        </label>
                     </div>
                     <button 
                        type="submit" 
                        disabled={isSubmitting || (!newComment.trim() && !commentFile)}
                        className="px-4 py-2 max-lg:min-h-11 max-lg:text-xs bg-primary text-black font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-2 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
                     >
                        <Send className="w-3 h-3" />
                        {isSubmitting ? 'Enviando...' : 'Publicar'}
                     </button>
                  </div>
               </form>
            </div>
         </div>

         {/* Fixed Footer for Save Action */}
         {isEditing && (
            <div className="p-4 border-t border-surface-container-high bg-surface-container-low flex justify-end gap-3 shrink-0 animate-in slide-in-from-bottom-5 fade-in duration-200 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
               <button onClick={() => { setIsEditing(false); setEditedTitle(task.title); setEditedDesc(task.description||''); setEditedAssignedTo(task.assigned_to || ''); }} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">Cancelar</button>
               <button onClick={handleSave} disabled={isSubmitting} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-gradient-to-br from-primary to-primary-dim text-black shadow-[0_4px_14px_rgba(151,169,255,0.3)] hover:shadow-[0_6px_20px_rgba(151,169,255,0.4)] disabled:opacity-50 transition-all flex items-center gap-2">
                  {isSubmitting ? (
                     <>⏳ Guardando...</>
                  ) : (
                     <>✓ Guardar Cambios</>
                  )}
               </button>
            </div>
         )}
         </div>
      </div>
    </>
   )
}

function CommentItem({ 
   comment, 
   onReply, 
   onDelete, 
   currentUserId, 
   isReply = false,
   canManage = false,
   onDeleteAttachment
}: { 
   comment: TaskComment, 
   onReply?: () => void, 
   onDelete: () => void, 
   currentUserId: string,
   isReply?: boolean,
   canManage?: boolean,
   onDeleteAttachment?: (att: Attachment) => void
}) {
   const isAuthor = comment.user_id === currentUserId;

   return (
      <div className="flex gap-3 group/comment">
         <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 border border-outline-variant/20 ${isReply ? 'scale-90' : ''}`}>
            <img 
               src={comment.profile?.avatar_url || fallbackAvatar(comment.user_id)} 
               alt="Avatar" 
               className="w-full h-full object-cover" 
            />
         </div>
         <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
               <span className="text-[11px] font-bold text-on-surface">
                  {comment.profile?.full_name || comment.profile?.email}
               </span>
               <span className="text-[9px] text-on-surface-variant/60 font-medium flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  {new Date(comment.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
               </span>
            </div>
            <div className="bg-surface-container-high px-4 py-2.5 rounded-2xl rounded-tl-none border border-outline-variant/10">
               <p className="text-sm text-on-surface/90 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
               
               {/* Adjuntos del comentario */}
               {comment.attachments && comment.attachments.length > 0 && (
                 <div className="mt-3 flex flex-wrap gap-2">
                   {comment.attachments.map(att => (
                     <div key={att.id} className="group/att flex items-center gap-2 bg-surface-container p-1.5 pr-2 rounded-xl border border-outline-variant/20 hover:border-primary/30 transition-all">
                       <FileText className="w-3.5 h-3.5 text-on-surface-variant" />
                       <span className="text-[10px] font-medium text-on-surface truncate max-w-[120px]" title={att.file_name}>{att.file_name}</span>
                       <div className="flex items-center gap-1 ml-1">
                         {/* Button for download (logic moved to parent or helper) */}
                         {(isAuthor || canManage) && (
                           <button onClick={() => onDeleteAttachment?.(att)} className="p-1 hover:bg-error/10 text-error/40 hover:text-error rounded-lg transition-colors">
                             <Trash2 className="w-3 h-3" />
                           </button>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
            <div className="flex items-center gap-4 mt-0.5 ml-1">
               {!isReply && onReply && (
                  <button onClick={onReply} className="text-[9px] font-black uppercase tracking-tighter text-primary hover:underline flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                     <Reply className="w-3 h-3" /> Responder
                  </button>
               )}
               {isAuthor && (
                  <button onClick={onDelete} className="text-[9px] font-black uppercase tracking-tighter text-on-surface-variant hover:text-error flex items-center gap-1 opacity-0 group-hover/comment:opacity-40 hover:!opacity-100 transition-opacity">
                     <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
               )}
            </div>
         </div>
      </div>
   )
}
