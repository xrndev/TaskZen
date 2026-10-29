/**
 * Genera todos los PNG de la marca (web, app Android y docs) a partir de docs/brand/serenboard-marca.svg.
 *   node scripts/generar-marca.mjs
 * Usa `sharp` (ya viene con Next) y la fuente Geist que incluye Next para el nombre.
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const at = (...p) => path.join(root, ...p)
const FONT = at('node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf')

const svg = readFileSync(at('docs', 'brand', 'serenboard-marca.svg'), 'utf8')
// La misma forma en una sola tinta (sirve para avisos y para el icono monocromo): el canal sigue siendo transparente.
const mono = (color) => svg.replace(/<linearGradient[\s\S]*?<\/linearGradient>/, '').replace('stroke="url(#g)"', `stroke="${color}"`)

/** La S ya renderizada, recortada a su caja y centrada en un lienzo cuadrado `size` ocupando `fill` del lado. */
async function marca(size, fill, source = svg) {
  const side = Math.round(size * fill)
  const big = await sharp(Buffer.from(source), { density: 600 }).resize(2048, 2048).png().toBuffer()
  const trimmed = await sharp(big).trim({ threshold: 1 }).png().toBuffer()
  const glyph = await sharp(trimmed).resize(side, side, { fit: 'inside' }).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: glyph, gravity: 'centre' }]).png().toBuffer()
}

/** Cuadrado de color con esquinas redondeadas (o sin ellas) y la marca encima. */
async function icono(size, fill, bg, radiusPct, source = svg) {
  const base = radiusPct
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * radiusPct}" fill="${bg}"/></svg>`)
    : await sharp({ create: { width: size, height: size, channels: 4, background: bg } }).png().toBuffer()
  return sharp(base).composite([{ input: await marca(size, fill, source) }]).png().toBuffer()
}

async function texto(markup, size) {
  return sharp({ text: { text: `<span size="${size * 1024}">${markup}</span>`, font: 'Geist', fontfile: FONT, rgba: true, dpi: 72 } }).png().toBuffer()
}

/** Logo completo: marca arriba y «Serenboard» debajo. */
async function logoCompleto(ink, inkSoft) {
  const W = 1200
  const mk = await marca(640, 1)
  const wordmark = await texto(`<span foreground="${inkSoft}" weight="light">Seren</span><span foreground="${ink}" weight="bold">board</span>`, 190)
  const { width: tw, height: th } = await sharp(wordmark).metadata()
  const scale = Math.min(1, 940 / tw)
  const wm = await sharp(wordmark).resize(Math.round(tw * scale), Math.round(th * scale)).png().toBuffer()
  const wmH = Math.round(th * scale)
  return sharp({ create: { width: W, height: W, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mk, left: (W - 640) / 2, top: 110 }, { input: wm, left: Math.round((W - Math.round(tw * scale)) / 2), top: 110 + 640 + 60 }])
    .png().toBuffer()
}

/** Imagen para compartir enlaces (Open Graph / Twitter): 1200×630, fondo oscuro, marca a la izquierda y texto a la derecha. */
async function imagenSocial() {
  const W = 1200, H = 630
  const fondo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="r" cx="20%" cy="0%" r="90%"><stop offset="0" stop-color="#1b1456"/><stop offset="1" stop-color="#0b0620"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#r)"/></svg>`)
  const mk = await marca(340, 1)
  const nombre = await texto('<span foreground="#6FD3EA" weight="light">Seren</span><span foreground="#E6ECFF" weight="bold">board</span>', 100)
  const lema = await texto('<span foreground="#B9B6E6">Tablero Kanban en equipo, con calma.</span>', 34)
  const lema2 = await texto('<span foreground="#8C89C7">Gratis para empezar · Web y app Android</span>', 28)
  const alto = async (b) => (await sharp(b).metadata()).height
  const x = 500
  return sharp(fondo).composite([
    { input: mk, left: 90, top: Math.round((H - 340) / 2) },
    { input: nombre, left: x, top: 190 },
    { input: lema, left: x, top: 190 + (await alto(nombre)) + 40 },
    { input: lema2, left: x, top: 190 + (await alto(nombre)) + 40 + (await alto(lema)) + 22 },
  ]).png().toBuffer()
}

const write = async (file, buf) => { mkdirSync(path.dirname(file), { recursive: true }); await sharp(buf).toFile(file); console.log('·', path.relative(root, file)) }
const BLANCO = '#ffffff'
const FONDO = { r: 255, g: 255, b: 255, alpha: 1 }

// docs/brand
await write(at('docs', 'brand', 'serenboard-monograma.png'), await marca(1024, 0.9))
await write(at('docs', 'brand', 'serenboard-logo.png'), await logoCompleto('#26236B', '#0E7C8F'))
await write(at('docs', 'brand', 'serenboard-logo-fondo-oscuro.png'), await logoCompleto('#E6ECFF', '#6FD3EA'))

// Web
await write(at('src', 'app', 'opengraph-image.png'), await imagenSocial())
await write(at('public', 'logo-mark.png'), await marca(512, 1))
await write(at('public', 'logo.png'), await marca(1024, 1))
await write(at('public', 'icon-512.png'), await icono(512, 0.62, BLANCO, 0.22))
await write(at('src', 'app', 'icon.png'), await icono(512, 0.62, BLANCO, 0.22))
await write(at('public', 'icon-192.png'), await icono(192, 0.62, BLANCO, 0.22))
await write(at('public', 'apple-touch-icon.png'), await icono(180, 0.62, FONDO, 0))
await write(at('public', 'icon-maskable-512.png'), await icono(512, 0.5, FONDO, 0)) // zona segura del 80 %
await write(at('public', 'badge-96.png'), await marca(96, 0.88, mono('#ffffff'))) // silueta: Android solo usa el canal alfa

// App Android
await write(at('native', 'mobile', 'assets', 'logo-mark.png'), await marca(512, 1))
await write(at('native', 'mobile', 'assets', 'icon.png'), await icono(1024, 0.62, FONDO, 0))
await write(at('native', 'mobile', 'assets', 'android-icon-foreground.png'), await marca(1024, 0.5)) // zona segura del 66 %
await write(at('native', 'mobile', 'assets', 'splash-icon.png'), await marca(1024, 0.5))
await write(at('native', 'mobile', 'assets', 'favicon.png'), await icono(48, 0.7, BLANCO, 0.22))
await write(at('native', 'mobile', 'assets', 'notification-icon.png'), await marca(96, 0.88, mono('#ffffff')))
