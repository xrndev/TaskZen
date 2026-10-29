import Link from 'next/link'
import { LegalLinks } from '@/components/LegalPage'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { ArrowRight, LayoutDashboard, Zap, Shield, Sparkles } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-on-surface font-sans overflow-x-hidden selection:bg-primary/30">
      {/* Header NavBar */}
      <header className="fixed top-0 w-full z-50 border-b border-surface-container-high/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-primary/10 flex items-center justify-center bg-white p-1">
               <img src="/logo-mark.png" alt="Serenboard Logo" className="w-full h-full object-contain" />
             </div>
             <span className="text-xl font-black tracking-tight text-on-surface">Serenboard</span>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="hidden sm:flex items-center gap-3 text-sm font-medium text-on-surface-variant">
               <span>Pruébate un color</span> <ArrowRight className="w-4 h-4 opacity-50"/> 
               <ThemeSwitcher />
             </div>
             <div className="sm:hidden">
               <ThemeSwitcher />
             </div>
             
             <a 
               href="/login" 
               className="relative z-[60] px-5 py-2 text-sm font-bold bg-surface-container border border-outline-variant/30 text-on-surface hover:text-primary hover:border-primary/50 rounded-xl transition-all hover:shadow-[0_0_15px_rgba(var(--color-primary),0.2)]"
             >
               Acceder
             </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto relative flex flex-col items-center justify-center text-center min-h-[85vh]">
         {/* Background Glow */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
         
         <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/30 text-xs font-bold uppercase tracking-widest text-primary mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
           <Sparkles className="w-3.5 h-3.5" /> Ahora en Fase Beta
         </div>
         
         <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-on-surface mb-6 max-w-4xl leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both">
           Tus ideas por fin ordenadas en <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Cristal</span>.
         </h1>
         
         <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both leading-relaxed">
           Serenboard es un lienzo en blanco para tu productividad. Un tablero Kanban ultrarrápido, arrastrable, y con sincronización en tiempo real gestionando múltiples temas estéticos.
         </p>
         
         <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both relative z-10">
            <a 
              href="/board" 
              className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-primary to-primary-dim text-black font-extrabold text-sm uppercase tracking-widest rounded-2xl shadow-[0_0_40px] shadow-primary/40 hover:shadow-[0_0_60px] hover:shadow-primary/60 hover:scale-105 transition-all"
            >
              Comenzar Gratis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
         </div>

         {/* Faux Kanban UI Sneak Peek */}
         <div className="mt-20 w-full max-w-5xl relative animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-700 fill-mode-both perspective-[1000px]">
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            
            {/* Contenedor ladeado simulando un Board App */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 transform md:rotate-x-12 md:rotate-y-[-5deg] md:scale-95 shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-3xl border border-surface-container-high bg-surface-container-lowest/50 p-6 backdrop-blur-sm transition-transform duration-700 hover:rotate-0 hover:scale-100">
               
               {/* Col 1 */}
               <div className="flex flex-col gap-4 bg-surface-container-low rounded-xl p-4 min-h-[300px] border border-surface-container-high opacity-80 shadow-inner">
                 <div className="flex items-center gap-2 mb-2">
                   <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px] shadow-secondary" />
                   <h2 className="font-semibold text-on-surface uppercase tracking-wider text-[10px]">Backlog</h2>
                 </div>
                 <div className="bg-surface-container rounded-lg p-3 border border-outline-variant/10 shadow-sm">
                    <p className="text-sm font-semibold text-on-surface">Logo de Serenboard Completado</p>
                    <p className="text-xs text-on-surface-variant mt-2">&quot;Que transmita paz y fluidez.&quot;</p>
                 </div>
                 <div className="bg-surface-container rounded-lg p-3 border border-outline-variant/10 shadow-sm border-l-2 border-l-error">
                    <p className="text-sm font-semibold text-on-surface">Subir a Producción</p>
                 </div>
               </div>

               {/* Col 2 */}
               <div className="flex flex-col gap-4 bg-surface-container-low rounded-xl p-4 min-h-[300px] border border-surface-container-high">
                 <div className="flex items-center gap-2 mb-2">
                   <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
                   <h2 className="font-semibold text-on-surface uppercase tracking-wider text-[10px]">In Progress</h2>
                 </div>
                 <div className="bg-surface-container rounded-lg p-3 border border-primary/30 shadow-[0_0_15px] shadow-primary/10 ring-1 ring-primary/20 rotate-2 translate-x-2 transition-transform hover:rotate-0">
                    <div className="w-full h-24 bg-surface-container-high rounded bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300')] bg-cover bg-center mb-3" />
                    <p className="text-sm font-bold text-on-surface">Construir Landing Page</p>
                    <p className="text-xs text-on-surface-variant mt-1">Implementando el showcase de colores.</p>
                 </div>
               </div>

               {/* Col 3 */}
               <div className="hidden md:flex flex-col gap-4 bg-surface-container-low rounded-xl p-4 min-h-[300px] border border-surface-container-high opacity-60">
                 <div className="flex items-center gap-2 mb-2">
                   <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px] shadow-tertiary" />
                   <h2 className="font-semibold text-on-surface uppercase tracking-wider text-[10px]">Done</h2>
                 </div>
                 <div className="bg-surface-container rounded-lg p-3 border border-outline-variant/10 opacity-70">
                    <p className="text-sm font-semibold text-on-surface line-through">Sistema de Temas Dinámico</p>
                 </div>
               </div>
            </div>
         </div>
      </main>
      
      {/* Features */}
      <section className="bg-surface-container-lowest border-t border-surface-container-high py-24 relative z-20">
         <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-on-surface">Arquitectura Glassmorphism</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Inspirado en los cristales oscuros de MacOS. Sombras paramétricas, bordes sutiles de la paleta y texturas esmeriladas.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shadow-inner">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-on-surface">Arrastrar y Soltar Mítico</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">No tienes que esperar a que el servidor piense. Movimientos proyectados fluidos controlados por un motor físico frontend reactivo.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary shadow-inner">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-on-surface">Autenticación Definitiva</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">Tu información protegida en PostgreSQL, con permisos por rol comprobados en el servidor y acceso con Google, Microsoft, GitHub o passkey.</p>
            </div>
         </div>
      </section>
      
      <footer className="bg-surface-container-low border-t border-surface-container-high py-8 text-center text-sm text-on-surface-variant">
         <p>© {new Date().getFullYear()} Serenboard App. Construido a pulso y código.</p>
         <LegalLinks className="mt-3 justify-center" />
      </footer>
    </div>
  )
}
