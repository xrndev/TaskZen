'use client'

import { useState } from 'react'
import { uploadAvatar } from '@/lib/api'
import { toast } from '@/lib/toast'
import { Profile } from '@/types'
import { LegalLinks } from './LegalPage'
import { NotificationSettings } from './NotificationSettings'
import { SecuritySettings } from './SecuritySettings'
import { LogOut, Image as ImageIcon, Upload, X, Check } from 'lucide-react'
import { fallbackAvatar } from '@/lib/avatar';

export function ProfileModal({ 
   isOpen, 
   profile, 
   onClose, 
   onUpdateProfile, 
   onLogout 
}: { 
   isOpen: boolean, 
   profile: Profile | null, 
   onClose: () => void, 
   onUpdateProfile: (changes: Partial<Profile>) => Promise<void>, 
   onLogout: () => void 
}) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  // null = sin editar: se muestra el nombre del perfil.
  const [editedName, setEditedName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  if (!isOpen || !profile) return null;

  const nameInput = editedName ?? profile.full_name ?? '';

  const currentAvatar = profile.avatar_url || fallbackAvatar(profile.id);

  const handleSubmitAvatar = async () => {
    setIsSubmitting(true);
    let newUrl = profile.avatar_url;

    try {
       if (activeTab === 'url' && avatarUrlInput.trim()) {
           newUrl = avatarUrlInput.trim();
       } else if (activeTab === 'upload' && selectedFile) {
           newUrl = await uploadAvatar(selectedFile);
       }

        const nameTrimmed = nameInput.trim();
        const nameChanged = nameTrimmed !== (profile.full_name || '').trim();
        const avatarChanged = newUrl !== profile.avatar_url && newUrl;

        if (nameChanged || avatarChanged) {
            const changes: Partial<Profile> = {};
            if (nameChanged) changes.full_name = nameTrimmed;
            if (avatarChanged) changes.avatar_url = newUrl as string;

            await onUpdateProfile(changes);
            toast.success("¡Perfil actualizado!");
            setAvatarUrlInput('');
            setSelectedFile(null);
            setEditedName(null);
            onClose(); // Auto-close on success for better UX
        }
    } catch(err: unknown) {
        console.error(err);
        toast.error((err instanceof Error && err.message) || "Error al actualizar el perfil. Inténtalo de nuevo.");
    }
    
    setIsSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto bg-surface-container-low border border-outline-variant/10 rounded-3xl shadow-[0_12px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200 ease-out">
         {/* Botón cerrar sutil */}
         <button onClick={onClose} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors p-1.5 rounded-full hover:bg-surface-container-highest">
            <X className="w-4 h-4" />
         </button>

         {/* Información Central del Perfil */}
          <div className="flex flex-col items-center gap-4 mt-2 mb-6 w-full">
             <div className="w-24 h-24 rounded-full border-4 border-surface-container shadow-[0_0_20px_rgba(151,169,255,0.15)] overflow-hidden bg-surface-container-high relative group">
                <img src={currentAvatar} alt="Current Avatar" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
             </div>
             <div className="text-center w-full px-4">
                <input 
                   type="text" 
                   value={nameInput}
                   onChange={e => setEditedName(e.target.value)}
                   placeholder="Tu nombre completo"
                   className="w-full bg-transparent border-b border-outline-variant/30 text-center text-xl font-black tracking-tight text-on-surface focus:outline-none focus:border-primary transition-all py-1 placeholder:text-on-surface-variant/30"
                />
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mt-2">{profile.email}</p>
             </div>
          </div>

         {/* Controles de Actualización de Avatar */}
         <div className="border-t border-outline-variant/10 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/80 mb-4 flex items-center gap-2">
               <ImageIcon className="w-4 h-4" /> Personalizador de Avatar
            </h3>
            
            <div className="flex bg-surface-container rounded-lg p-1 mx-auto max-w-[200px] mb-5 shadow-inner border border-outline-variant/10">
              <button onClick={() => setActiveTab('url')} className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'url' ? 'bg-outline-variant/20 text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>LINK</button>
              <button onClick={() => setActiveTab('upload')} className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'upload' ? 'bg-outline-variant/20 text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>SUBIR</button>
            </div>

            {activeTab === 'url' ? (
              <div className="space-y-3">
                 <input 
                    type="url" 
                    placeholder="https://..." 
                    value={avatarUrlInput} 
                    onChange={e => setAvatarUrlInput(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 text-sm rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-medium placeholder:text-on-surface-variant/50"
                 />
              </div>
            ) : (
              <div className="space-y-3">
                 <div className="border border-dashed border-outline-variant/30 rounded-xl p-5 text-center hover:bg-surface-container-lowest transition-colors relative cursor-pointer group shadow-inner">
                    <input 
                       type="file" 
                       accept="image/*"
                       onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                       className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-6 h-6 mx-auto mb-2 text-primary/50 group-hover:text-primary transition-colors" />
                    <p className="text-[11px] uppercase tracking-wider text-on-surface font-semibold">
                       {selectedFile ? selectedFile.name : 'Toca para elegir archivo'}
                    </p>
                 </div>
              </div>
            )}

            <button 
               onClick={handleSubmitAvatar}
               disabled={isSubmitting || (nameInput.trim() === (profile.full_name || '').trim() && (activeTab === 'url' ? !avatarUrlInput.trim() : !selectedFile))}
               className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-gradient-to-br from-primary to-primary-dim text-black font-extrabold text-[11px] tracking-widest rounded-xl uppercase shadow-[0_4px_14px_rgba(151,169,255,0.2)] hover:shadow-[0_6px_20px_rgba(151,169,255,0.3)] disabled:opacity-50 disabled:grayscale transition-all"
            >
               {isSubmitting ? 'Actualizando Perfil...' : <><Check className="w-4 h-4" /> Aplicar Cambios</>}
            </button>
         </div>

         <SecuritySettings />
         <NotificationSettings />

         {/* Sector Zona Roja */}
         <div className="mt-6 pt-4 border-t border-outline-variant/10">
            <button 
               onClick={onLogout}
               className="w-full flex items-center justify-center gap-2 py-3 bg-error/10 text-error font-extrabold text-[11px] tracking-widest rounded-xl uppercase hover:bg-error hover:text-white transition-all shadow-sm border border-error/20"
            >
               <LogOut className="w-4 h-4" /> Cerrar tu sesión
            </button>
            <LegalLinks className="mt-4 justify-center text-xs text-on-surface-variant" />
         </div>
      </div>
    </div>
  )
}
