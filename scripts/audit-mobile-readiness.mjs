#!/usr/bin/env node
/**
 * Auditoría de preparación para apps Android/iOS y notificaciones push.
 * Sin dependencias: lee el código y la configuración del repositorio y escribe un informe.
 *
 *   node scripts/audit-mobile-readiness.mjs          # tabla en la terminal
 *   node scripts/audit-mobile-readiness.mjs --json   # salida para otras herramientas
 *
 * Código de salida: 1 si hay algún BLOQUEO (útil para CI), 0 en otro caso.
 * Niveles: OK (cumple) · AVISO (conviene revisarlo) · BLOQUEO (impide publicar en tienda o enviar push) · INFO.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const json = process.argv.includes('--json')

const read = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p), 'utf8') : '')
const exists = (p) => existsSync(path.join(ROOT, p))

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir)
  if (!existsSync(abs)) return out
  for (const name of readdirSync(abs)) {
    const rel = path.join(dir, name).split(path.sep).join('/')
    if (['node_modules', '.next', '.git', 'uploads', 'uploads-e2e'].includes(name)) continue
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(tsx?|mjs|json|ya?ml)$/.test(name)) out.push(rel)
  }
  return out
}

const srcFiles = walk('src')
const sources = new Map(srcFiles.map((f) => [f, read(f)]))
const grep = (re, files = srcFiles) => files.filter((f) => re.test(sources.get(f) ?? read(f)))
const count = (re) => [...sources.values()].reduce((n, s) => n + (s.match(re) ?? []).length, 0)

const results = []
const add = (id, level, title, detail, fix = '') => results.push({ id, level, title, detail, fix })

/* ---------- Notificaciones push y recordatorios ---------- */
const swFiles = ['public/sw.js', 'public/service-worker.js', 'src/app/sw.ts'].filter(exists)
add('push-sw', swFiles.length ? 'OK' : 'BLOQUEO', 'Service worker (necesario para Web Push)',
  swFiles.length ? swFiles.join(', ') : 'No hay service worker: el navegador no puede recibir notificaciones push.',
  'Añadir public/sw.js con los manejadores push y notificationclick (ver skill push-reminders-design).')

const schema = read('src/db/schema.ts')
const hasSubs = /push_?subscriptions|notification_?endpoints/i.test(schema)
add('push-subs', hasSubs ? 'OK' : 'BLOQUEO', 'Tabla de suscripciones push', hasSubs ? 'Existe en el esquema.' : 'No hay dónde guardar los dispositivos de cada usuario.',
  'Crear notification_endpoints (usuario, tipo webpush|fcm|apns, endpoint único, claves) con migración.')

const hasPrefs = /notification_?prefs|reminder_?offsets/i.test(schema)
add('push-prefs', hasPrefs ? 'OK' : 'AVISO', 'Preferencias de notificación por usuario', hasPrefs ? 'Existen.' : 'Sin opt-in/opt-out ni horario silencioso (Apple 4.5.4 exige poder desactivarlas).',
  'Añadir notification_prefs: activadas, antelaciones en minutos, horas de silencio y zona horaria.')

const hasLog = /reminder_?log|notification_?outbox/i.test(schema)
add('push-log', hasLog ? 'OK' : 'BLOQUEO', 'Registro idempotente de recordatorios enviados', hasLog ? 'Existe.' : 'Sin registro, un reinicio del programador repetiría avisos.',
  'Crear reminder_log con UNIQUE(task_id, user_id, offset_minutes) y reclamar la fila antes de enviar.')

const compose = read('deploy/docker-compose.yml')
const hasWorker = /^\s{2}(worker|scheduler|cron)\s*:/m.test(compose) || grep(/setInterval|node-cron|pg-boss|instrumentation/).some((f) => f.startsWith('src/server'))
add('push-worker', hasWorker ? 'OK' : 'BLOQUEO', 'Proceso programado que dispara los recordatorios', hasWorker ? 'Detectado.' : 'Nada recorre las fechas límite en segundo plano: hoy solo hay aviso dentro de la app.',
  'Añadir un servicio worker (misma imagen, otro comando) que se ejecute cada minuto con bloqueo consultivo de Postgres.')

const hasWebPushLib = /"web-push"/.test(read('package.json'))
add('push-lib', hasWebPushLib ? 'OK' : 'INFO', 'Librería de envío Web Push (VAPID)', hasWebPushLib ? 'web-push instalada.' : 'Pendiente de instalar (npm i web-push).', '')

/* ---------- Requisitos de las tiendas ---------- */
const deletion = grep(/deleteAccount|delete-?user|deleteUser|removeAccount/i, srcFiles.filter((f) => !f.includes('e2e')))
add('store-delete', deletion.length ? 'OK' : 'BLOQUEO', 'Borrado de cuenta dentro de la app (Apple 5.1.1.v y Google Play)',
  deletion.length ? deletion.join(', ') : 'No existe. Ambas tiendas lo exigen si la app permite crear cuenta; además lo pide el RGPD.',
  'Acción server-side que borre usuario, equipos propios sin más admins, adjuntos del disco y sesiones; botón en el perfil.')

const privacy = ['src/app/privacy/page.tsx', 'src/app/privacidad/page.tsx', 'src/app/legal/page.tsx'].some(exists)
add('store-privacy', privacy ? 'OK' : 'BLOQUEO', 'Política de privacidad pública (URL obligatoria en las fichas)', privacy ? 'Existe.' : 'No hay página de privacidad ni de condiciones.',
  'Crear /privacidad y /terminos y enlazarlas desde el login y el perfil.')

const authSrc = read('src/lib/auth.ts')
const socialCount = ['google', 'microsoft', 'github'].filter((p) => new RegExp(`${p}\\s*:`).test(authSrc)).length
const apple = /apple\s*:/.test(authSrc)
add('store-apple-login', socialCount === 0 || apple ? 'OK' : 'AVISO', 'Apple 4.8: login social exige otra opción equivalente (Iniciar con Apple)',
  `${socialCount} proveedores sociales${apple ? ' + Apple' : ' y sin Apple'}. La excepción solo cubre apps que usan exclusivamente su propio sistema de cuentas.`,
  'En la build de iOS, o bien añadir Sign in with Apple, o bien ocultar los botones de proveedores (por capacidad de plataforma, no con ramas de código).')

const domain = read('deploy/docker-compose.yml') + read('docs/DEPLOY.md')
const tempDomain = /duckdns|sslip/i.test(domain)
add('store-domain', tempDomain ? 'AVISO' : 'OK', 'Dominio estable (Digital Asset Links, Universal Links y passkeys dependen de él)',
  tempDomain ? 'El dominio actual es un subdominio gratuito (DuckDNS). Cambiarlo invalida passkeys y los enlaces de verificación de las apps.' : 'Dominio propio.',
  'Comprar un dominio propio antes de publicar en cualquier tienda.')

const wk = exists('public/.well-known/assetlinks.json') || exists('src/app/.well-known/assetlinks.json/route.ts')
const aasa = exists('public/.well-known/apple-app-site-association') || exists('src/app/.well-known/apple-app-site-association/route.ts')
add('store-links', wk && aasa ? 'OK' : 'INFO', 'Enlaces verificados (assetlinks.json y apple-app-site-association)', `Android: ${wk ? 'sí' : 'no'} · iOS: ${aasa ? 'sí' : 'no'}`, 'Se crean al elegir la vía de empaquetado (TWA o Capacitor).')

/* ---------- Acoplamiento al servidor de Next ---------- */
const nextCfg = read('next.config.ts')
const serverActions = srcFiles.filter((f) => f.startsWith('src/server/actions') && /'use server'/.test(sources.get(f))).length
add('arch-actions', 'INFO', 'Dependencia de server actions', `${serverActions} archivos de acciones. Un cliente nativo con la web empaquetada no puede llamarlas: necesitaría una API HTTP.`,
  'Si algún día se empaqueta la web dentro de la app, exponer /api/v1 con route handlers que llamen a los mismos servicios (ya son independientes de Next).')
add('arch-export', /output:\s*['"]export['"]/.test(nextCfg) ? 'AVISO' : 'OK', 'Exportación estática (output: export)', /output:\s*['"]standalone['"]/.test(nextCfg) ? 'standalone (servidor Node): correcto para esta app.' : nextCfg.includes('export') ? 'export: incompatible con server actions.' : 'No definida.', '')

const services = srcFiles.filter((f) => f.startsWith('src/server/services/'))
const servicesFramework = services.filter((f) => /from ['"]next\//.test(sources.get(f)))
add('arch-services', servicesFramework.length === 0 ? 'OK' : 'AVISO', 'Servicios de negocio independientes del framework',
  `${services.length} servicios; ${servicesFramework.length} importan next/*. Es lo que permite añadir otra puerta de entrada (API, worker) sin duplicar reglas.`, '')

const platform = exists('src/lib/platform.ts')
add('arch-platform', platform ? 'OK' : 'AVISO', 'Capa de capacidades de plataforma', platform ? 'src/lib/platform.ts' : 'No existe. Sin ella, el código acabaría con ramas "if (iOS)" repartidas por los componentes.',
  'Crear src/lib/platform.ts con detección de capacidades (isNativeShell, canWebPush, canShare…) y usarla en un único punto.')

/* ---------- Comportamiento dentro de un WebView ---------- */
const nativeApi = {
  'window.confirm/alert/prompt': /window\.(confirm|alert|prompt)\(/g,
  'window.open': /window\.open\(/g,
  'navigator.clipboard': /navigator\.clipboard/g,
  'localStorage/sessionStorage': /(local|session)Storage/g,
  EventSource: /new EventSource\(/g,
  'target="_blank"': /target=["']_blank["']/g,
}
const webviewNotes = Object.entries(nativeApi).map(([k, re]) => [k, count(re)]).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`)
add('webview-apis', 'INFO', 'APIs del navegador cuyo comportamiento cambia en un WebView', webviewNotes.join(' · ') || 'Ninguna.',
  'Probar cada una en dispositivo real. EventSource (SSE) se suspende con la app en segundo plano: al volver, refrescar los datos.')

const hardcoded = grep(/100vh|h-screen|min-h-screen/)
add('webview-vh', hardcoded.length === 0 ? 'OK' : 'AVISO', 'Alturas con 100vh (se cortan bajo las barras del navegador y del sistema)', hardcoded.length ? hardcoded.join(', ') : 'Todo usa dvh.', 'Sustituir por dvh.')

const layout = read('src/app/layout.tsx')
add('webview-safe', /viewportFit:\s*["']cover["']/.test(layout) && count(/safe-area-inset/g) > 0 ? 'OK' : 'AVISO', 'Márgenes de seguridad (muesca y barra inferior)', `viewport-fit=cover: ${/viewportFit/.test(layout) ? 'sí' : 'no'} · usos de safe-area-inset: ${count(/safe-area-inset/g)}`, '')

const manifest = read('src/app/manifest.ts')
add('pwa-manifest', /display:\s*['"]standalone['"]/.test(manifest) && /maskable/.test(manifest) ? 'OK' : 'AVISO', 'Manifest instalable (standalone + icono maskable)', /standalone/.test(manifest) ? 'standalone' + (/maskable/.test(manifest) ? ' + maskable' : '') : 'No detectado.', '')

const oauthWebview = socialCount > 0
add('webview-oauth', oauthWebview ? 'AVISO' : 'OK', 'OAuth dentro de un WebView', oauthWebview ? 'Google bloquea el login en WebViews incrustados (disallowed_useragent). Hay que abrir el navegador del sistema y devolver la sesión a la app.' : 'No hay login social.',
  'Diseñar el relevo de sesión con un token de un solo uso (plugin oneTimeToken / bearer de Better Auth) y Universal Links.')

const passkey = /passkey\(/.test(authSrc)
add('webview-passkey', passkey ? 'AVISO' : 'OK', 'Passkeys en WebView', passkey ? 'Dependen de Associated Domains (iOS) y Digital Asset Links (Android) y de un dominio estable. No verificado en dispositivo.' : 'No usa.', 'Probar en iPhone y Android reales antes de prometerlo.')

/* ---------- Red de seguridad de pruebas ---------- */
const e2e = walk('e2e').map((f) => f.replace(/\\/g, '/'))
add('qa-mobile', e2e.some((f) => /mobile/.test(f)) ? 'OK' : 'AVISO', 'Pruebas E2E en móvil con auditoría de accesibilidad', e2e.join(', ') || 'Ninguna.', '')
add('qa-native', 'INFO', 'Pruebas en dispositivo real', 'No hay. Las pruebas actuales emulan el móvil en Chromium, no cubren WKWebView ni el WebView de Android.', 'Probar a mano en un iPhone y un Android, y valorar Maestro o Appium para el flujo crítico.')

/* ---------- Salida ---------- */
const order = { BLOQUEO: 0, AVISO: 1, INFO: 2, OK: 3 }
results.sort((a, b) => order[a.level] - order[b.level])
const tally = results.reduce((t, r) => ((t[r.level] = (t[r.level] ?? 0) + 1), t), {})

if (json) {
  console.log(JSON.stringify({ tally, results }, null, 2))
} else {
  const icon = { BLOQUEO: '✖', AVISO: '▲', INFO: 'i', OK: '✔' }
  console.log('\nAuditoría de preparación móvil y push — Serenboard\n')
  for (const r of results) {
    console.log(`${icon[r.level]} [${r.level}] ${r.title}`)
    console.log(`    ${r.detail}`)
    if (r.fix && r.level !== 'OK') console.log(`    → ${r.fix}`)
  }
  console.log(`\nResumen: ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(' · ')}\n`)
}
process.exit(results.some((r) => r.level === 'BLOQUEO') ? 1 : 0)
