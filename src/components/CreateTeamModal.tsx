'use client'

import { useState } from 'react'
import { createNewTeam } from '@/lib/api'
import { Team } from '@/types'

export function CreateTeamModal({ 
  isOpen, 
  onClose, 
  onTeamCreated 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onTeamCreated: (team: Team) => void 
}) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    setError(null)

    const team = await createNewTeam(name.trim())
    
    if (team) {
      onTeamCreated(team)
      setName('')
      onClose()
    } else {
      setError('Hubo un error al crear el equipo. Inténtalo de nuevo.')
    }
    setIsSubmitting(false)
  }

  return (
    <>
      <div 
        className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />
      
      <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4 animate-in fade-in zoom-in duration-300">
        <div className="overflow-hidden rounded-3xl border border-surface-container-high bg-surface-container-low shadow-2xl">
          <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 pb-4">
            <h2 className="text-xl font-bold text-on-surface">Crear Nuevo Equipo</h2>
            <p className="text-xs text-on-surface-variant mt-1 uppercase tracking-widest font-bold">Workspace Colaborativo</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 pt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Nombre del Equipo</label>
              <input 
                autoFocus
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Proyecto Alpha, Familia, Marketing..."
                className="w-full rounded-2xl bg-surface-container border border-outline-variant/30 p-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-error font-bold text-center bg-error/10 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-8 py-3 rounded-xl bg-primary text-black font-bold uppercase tracking-wider shadow-[0_4px_14px_rgba(151,169,255,0.4)] hover:shadow-[0_6px_20px_rgba(151,169,255,0.6)] disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
              >
                {isSubmitting ? 'Creando...' : 'Crear Equipo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
