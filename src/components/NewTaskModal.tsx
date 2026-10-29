'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { TagSelector } from './TagSelector'
import { TeamMember } from '@/types'
import { fallbackAvatar } from '@/lib/avatar';

export interface NewTaskFormData {
  title: string;
  description: string;
  due_date: string | null;
  image_url: string | null;
  upload_file: File | null;
  tag_ids: string[];
  assigned_to: string | null;
}

export function NewTaskModal({ 
   isOpen, 
   onClose, 
   onSubmit,
   teamMembers = [],
   teamId = null
}: { 
   isOpen: boolean, 
   onClose: () => void, 
   onSubmit: (data: NewTaskFormData) => Promise<void>,
   teamMembers?: TeamMember[],
   teamId?: string | null
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        due_date: dueDate || null,
        image_url: imageMode === 'url' ? imageUrl : null,
        upload_file: imageMode === 'upload' ? imageFile : null,
        tag_ids: selectedTagIds,
        assigned_to: assignedTo || null
      });
      // Limpiar state al terminar
      setTitle('');
      setDescription('');
      setDueDate('');
      setImageUrl('');
      setImageFile(null);
      setImageMode('url');
      setSelectedTagIds([]);
      setAssignedTo('');
      onClose();
    } catch(err) {
      console.error(err)
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/50 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-surface-container-low rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-surface-container-high animate-in zoom-in-95">
        <div className="px-6 py-4 border-b border-surface-container-high bg-surface-container flex justify-between items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full scale-150" />
            <h2 className="text-lg font-bold text-on-surface relative z-10 tracking-tight">{t('nt.title')}</h2>
            <button type="button" onClick={onClose} className="relative z-10 text-on-surface-variant hover:text-error transition-colors">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto">
           <div>
             <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-bold">{t('nt.titleLabel')}</label>
             <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('nt.titlePh')} className="w-full px-4 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm focus:border-primary focus:ring-1 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all shadow-inner" />
           </div>
           
           <div>
             <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-bold">{t('nt.descLabel')}</label>
             <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('nt.descPh')} className="w-full px-4 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm focus:border-primary focus:ring-1 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all shadow-inner resize-none" rows={3}></textarea>
           </div>
           
           <div>
             <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-1 font-bold">{t('nt.dueLabel')}</label>
             <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm focus:border-primary focus:ring-1 focus:ring-primary/50 text-on-surface [color-scheme:dark] outline-none shadow-inner" />
           </div>

           <div>
              <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-2 font-bold">{t('nt.assigneeLabel')}</label>
              <div className="flex items-center gap-3 bg-surface-container rounded-lg border border-outline-variant/30 px-3 py-1.5 shadow-inner transition-all focus-within:border-primary/50">
                 <div className="w-6 h-6 rounded-full overflow-hidden border border-outline-variant/20 bg-surface-container-high">
                   <img 
                     src={teamMembers.find(m => m.user_id === assignedTo)?.profile?.avatar_url || fallbackAvatar(assignedTo || 'none')} 
                     alt="Avatar" 
                     className="w-full h-full object-cover" 
                   />
                 </div>
                 <select 
                   value={assignedTo} 
                   onChange={(e) => setAssignedTo(e.target.value)} 
                   className="flex-1 bg-transparent text-sm text-on-surface focus:outline-none appearance-none cursor-pointer"
                 >
                   <option value="" className="bg-surface-container">{t('nt.unassigned')}</option>
                   {teamMembers.map(m => (
                     <option key={m.id} value={m.user_id} className="bg-surface-container">
                       {m.profile?.full_name || m.profile?.email} ({m.role})
                     </option>
                   ))}
                 </select>
              </div>
           </div>

           <div>
              <label className="block text-[10px] uppercase tracking-wider text-on-surface-variant mb-2 font-bold">{t('nt.tagsLabel')}</label>
              <TagSelector selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} teamId={teamId} />
           </div>

           <div className="border border-outline-variant/20 rounded-xl p-4 bg-surface-container mt-2">
             <div className="flex gap-4 mb-3 border-b border-outline-variant/10 pb-2">
                <button type="button" onClick={() => setImageMode('url')} className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${imageMode === 'url' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Link Ext.</button>
                <button type="button" onClick={() => setImageMode('upload')} className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${imageMode === 'upload' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>{t('nt.uploadFile')}</button>
             </div>
             
             {imageMode === 'url' ? (
                <input type="url" placeholder="https://unsplash.com/foto.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-xs focus:border-primary focus:ring-1 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all" />
             ) : (
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:tracking-wider file:uppercase file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer file:transition-colors transition-colors" />
             )}
           </div>

           <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">{t('common.cancel')}</button>
              <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-gradient-to-br from-primary to-primary-dim text-black hover:shadow-[0_0_20px_rgba(151,169,255,0.4)] disabled:opacity-50 transition-all">
                {isSubmitting ? t('nt.saving') : t('nt.submit')}
              </button>
           </div>
        </form>
      </div>
    </div>
  )
}
