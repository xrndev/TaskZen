import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import QRCode from 'qrcode'

export const metadata: Metadata = { title: 'Instalar TaskZen' }
export const dynamic = 'force-dynamic'

const STEP = 'flex gap-3 text-[15px] leading-relaxed text-on-surface'
const NUM = 'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-black'

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-4 flex flex-col gap-3">
      {items.map((t, i) => (
        <li key={i} className={STEP}>
          <span className={NUM} aria-hidden>{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  )
}

export default async function InstallPage() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`
  // El QR apunta a esta misma página: se escanea con el móvil de la otra persona.
  const qr = await QRCode.toString(`${origin}/instalar`, { type: 'svg', margin: 1, width: 168, color: { dark: '#0b0620', light: '#ffffff' } })

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-on-surface" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">← Volver a TaskZen</Link>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Instala TaskZen en tu móvil</h1>
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-on-surface/80">
            Se abre como una app, a pantalla completa y con su icono. No está en las tiendas de aplicaciones, así que se instala desde aquí.
          </p>
        </header>

        <section aria-labelledby="android" className="rounded-2xl border border-outline-variant/20 bg-surface-container p-5">
          <h2 id="android" className="text-xl font-bold">Android</h2>
          <a
            href="/descargas/TaskZen.apk"
            download
            className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-bold text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Descargar la app (APK)
          </a>
          <Steps
            items={[
              <>Descarga el archivo y ábrelo desde las notificaciones o desde <strong>Descargas</strong>.</>,
              <>Si el móvil lo pide, activa <strong>Permitir desde esta fuente</strong> para tu navegador o gestor de archivos.</>,
              <>Si Google Play Protect avisa de una app desconocida, pulsa <strong>Más detalles → Instalar de todos modos</strong>. Sale porque la app no pasa por Google Play.</>,
              <>Abre TaskZen e inicia sesión. Para actualizarla, descarga e instala el archivo nuevo encima.</>,
            ]}
          />
          <p className="mt-4 text-sm leading-relaxed text-on-surface/80">
            Alternativa sin archivo: abre esta web en Chrome y elige <strong>Menú (⋮) → Instalar aplicación</strong>.
          </p>
        </section>

        <section aria-labelledby="iphone" className="rounded-2xl border border-outline-variant/20 bg-surface-container p-5">
          <h2 id="iphone" className="text-xl font-bold">iPhone y iPad</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-on-surface/80">
            Apple solo permite repartir apps fuera de su tienda a quien tiene una cuenta de desarrollador de pago. Por eso en iPhone se instala como app web, sin pasar por la App Store y sin ningún coste.
          </p>
          <Steps
            items={[
              <>Abre <strong>{origin.replace(/^https?:\/\//, '')}</strong> en <strong>Safari</strong>.</>,
              <>Toca el botón <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba).</>,
              <>Elige <strong>Añadir a pantalla de inicio</strong> y confirma con <strong>Añadir</strong>.</>,
              <>Abre TaskZen desde el icono nuevo, no desde Safari. Es la única forma de que funcionen las notificaciones.</>,
            ]}
          />
        </section>

        <section aria-labelledby="compartir" className="flex flex-col items-center gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container p-5 text-center sm:flex-row sm:text-left">
          <div
            className="shrink-0 rounded-xl bg-white p-2"
            role="img"
            aria-label={`Código QR que abre ${origin}/instalar`}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div>
            <h2 id="compartir" className="text-lg font-bold">Pásaselo a otra persona</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-on-surface/80">
              Que escanee este código con la cámara, o envíale el enlace <strong>{origin.replace(/^https?:\/\//, '')}/instalar</strong>. Para entrar necesitará una invitación de su equipo.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
