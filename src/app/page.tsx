import Link from 'next/link'
import { LegalLinks } from '@/components/LegalPage'
import { Faq, Pricing } from '@/components/pricing/Pricing'
import { SiteHeader } from '@/components/pricing/SiteHeader'
import { ArrowRight, Bell, MessageSquare, Shield, Smartphone, Sparkles, Users, Zap } from 'lucide-react'

const FEATURES = [
  { icon: Zap, tone: 'primary', title: 'Tablero en tiempo real', text: 'Arrastra tareas entre columnas y mira cómo se actualiza para todo el equipo al instante, en tablero, lista o calendario.' },
  { icon: Users, tone: 'secondary', title: 'Equipos y roles', text: 'Invita con un enlace o por correo y reparte permisos: administrador, product owner o miembro. Todo se comprueba en el servidor.' },
  { icon: Bell, tone: 'tertiary', title: 'Avisos que llegan', text: 'Recibe una notificación antes de que venza una tarea y cuando te asignan una. Con horas de silencio para que descanses.' },
  { icon: MessageSquare, tone: 'primary', title: 'Etiquetas, comentarios y adjuntos', text: 'Organiza con etiquetas jerárquicas, discute en hilos y adjunta archivos a cada tarea o comentario.' },
  { icon: Smartphone, tone: 'secondary', title: 'En tu móvil', text: 'Instálala como app desde el navegador o descarga la app nativa para Android, con la misma cuenta y los mismos datos.' },
  { icon: Shield, tone: 'tertiary', title: 'Acceso seguro', text: 'Entra con Google, Microsoft, GitHub, un passkey o contraseña. Tus datos viven en una base de datos PostgreSQL propia.' },
] as const

const TONE = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  tertiary: 'bg-tertiary/10 text-tertiary',
} as const

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-on-surface font-sans overflow-x-hidden selection:bg-primary/30">
      <SiteHeader />

      {/* Hero */}
      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto relative flex flex-col items-center justify-center text-center min-h-[85vh]">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

         <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-high border border-outline-variant/30 text-xs font-bold uppercase tracking-widest text-primary mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
           <Sparkles className="w-3.5 h-3.5" /> Ahora en fase beta
         </div>

         <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-on-surface mb-6 max-w-4xl leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both">
           Organiza tu equipo con <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">calma</span>.
         </h1>

         <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both leading-relaxed">
           Serenboard es un tablero Kanban rápido y en tiempo real para trabajar en equipo o por tu cuenta. Empieza gratis y mejora solo lo que necesites.
         </p>

         <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both relative z-10">
            <a
              href="/board"
              className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-primary to-primary-dim text-black font-extrabold text-sm uppercase tracking-widest rounded-2xl shadow-[0_0_40px] shadow-primary/40 hover:shadow-[0_0_60px] hover:shadow-primary/60 hover:scale-105 transition-all"
            >
              Empezar gratis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link
              href="/precios"
              className="px-8 py-4 border border-outline-variant/40 text-on-surface font-bold text-sm uppercase tracking-widest rounded-2xl hover:border-primary hover:text-primary transition-all"
            >
              Ver planes
            </Link>
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

      {/* Qué incluye */}
      <section className="bg-surface-container-lowest border-t border-surface-container-high py-24 relative z-20" aria-labelledby="funciones-title">
         <div className="max-w-7xl mx-auto px-6">
            <h2 id="funciones-title" className="mb-14 text-center text-3xl md:text-4xl font-black tracking-tight text-on-surface">Todo lo que necesitas para avanzar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {FEATURES.map(({ icon: Icon, tone, title, text }) => (
                <div key={title} className="flex flex-col gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${TONE[tone]}`}>
                    <Icon className="w-6 h-6" aria-hidden />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface">{title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
         </div>
      </section>

      <Pricing />
      <Faq />

      {/* Llamada final */}
      <section className="border-t border-surface-container-high py-24 px-6 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl md:text-4xl font-black tracking-tight text-on-surface">Pon orden hoy. Decide después si necesitas más.</h2>
        <p className="mx-auto mt-4 max-w-xl text-on-surface-variant">El plan gratuito no caduca. Cuando tu equipo crezca, pruebas cualquier plan 14 días sin tarjeta.</p>
        <a
          href="/board"
          className="group mt-8 inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-primary to-primary-dim text-black font-extrabold text-sm uppercase tracking-widest rounded-2xl shadow-[0_0_40px] shadow-primary/40 hover:scale-105 transition-all"
        >
          Empezar gratis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </section>

      <footer className="bg-surface-container-low border-t border-surface-container-high py-8 text-center text-sm text-on-surface-variant">
         <p>© {new Date().getFullYear()} Serenboard</p>
         <p className="mt-2"><Link href="/precios" className="font-semibold text-primary hover:underline">Planes y precios</Link></p>
         <LegalLinks className="mt-3 justify-center" />
      </footer>
    </div>
  )
}
