'use client'

import { Palette } from 'lucide-react'
import { useState, useEffect } from 'react'

const THEMES = [
  { id: 'obsidian', name: 'Obsidian Glass', color: '#091328' },
  { id: 'light', name: 'Cloud Light', color: '#e2e8f0' },
  { id: 'nordic', name: 'Nordic Aurora', color: '#3b4252' },
  { id: 'espresso', name: 'Macchiato', color: '#3e322f' },
  { id: 'cyber', name: 'Cyber Neon', color: '#0a0320' }
];

export function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('cyber');

  const applyTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    localStorage.setItem('app-theme', themeId);
    // Inyecta el atributo en HTML para que TailWind V4 lo coja al vuelo
    document.documentElement.setAttribute('data-theme', themeId);
    setIsOpen(false);
  };

  // Startup: Load saved theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'cyber';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    applyTheme(saved);
  }, []);

  return (
    <div className="relative">
       <button 
         onClick={() => setIsOpen(!isOpen)}
         title="Cambiar Paleta de Colores"
         className="w-9 h-9 max-lg:w-11 max-lg:h-11 flex items-center justify-center rounded-full bg-surface-container-high border md:border-2 border-outline-variant/30 hover:border-primary/60 text-on-surface-variant hover:text-primary transition-colors shadow-sm"
       >
          <Palette className="w-4 h-4 md:w-5 md:h-5" />
       </button>

       {isOpen && (
         <>
           {/* Invisible backdrop to catch outside clicks */}
           <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
           
           {/* Dropdown Menu */}
           <div className="absolute right-0 top-12 w-48 bg-surface-container-high border border-outline-variant/30 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-2 z-50 animate-in fade-in slide-in-from-top-2 zoom-in-95 backdrop-blur-md">
             <div className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/80 mb-2 px-3 pt-2">
               Motor de Temas
             </div>
             <div className="flex flex-col gap-1">
               {THEMES.map(t => (
                 <button 
                   key={t.id}
                   onClick={() => applyTheme(t.id)}
                   className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-wider ${
                     currentTheme === t.id 
                       ? 'bg-primary/20 text-primary shadow-inner' 
                       : 'hover:bg-surface-container-highest text-on-surface hover:pl-4'
                   }`}
                 >
                   <span 
                      className={`w-3 h-3 rounded-full border shadow-sm ${currentTheme === t.id ? 'border-primary' : 'border-outline-variant/50'}`} 
                      style={{ backgroundColor: t.color }} 
                   />
                   {t.name}
                 </button>
               ))}
             </div>
           </div>
         </>
       )}
    </div>
  )
}
