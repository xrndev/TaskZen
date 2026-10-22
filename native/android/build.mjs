#!/usr/bin/env node
/**
 * Compila y firma el APK de TaskZen (Trusted Web Activity) sin depender del paso `build` de Bubblewrap,
 * que exige una disposición del SDK distinta a la habitual.
 *
 *   1. (si cambia twa-manifest.json)  npx @bubblewrap/cli@1.27.0 update --skipVersionUpgrade --manifest=./twa-manifest.json
 *   2. node build.mjs
 *
 * Resultado: dist/TaskZen.apk (firmado y alineado) y dist/TaskZen.apk.sha256.
 *
 * Variables (con valores por defecto de este equipo):
 *   JAVA17_HOME            JDK 17 (el plugin de Android de este proyecto lo necesita)
 *   ANDROID_HOME           SDK de Android
 *   TASKZEN_SIGNING_DIR    carpeta con taskzen.keystore y signing.env (FUERA del repositorio)
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const home = os.homedir()
const JAVA17 = process.env.JAVA17_HOME ?? 'C:\\versiones java\\jdk-17'
const SDK = process.env.ANDROID_HOME ?? path.join(home, 'AppData', 'Local', 'Android', 'Sdk')
const SIGNING = process.env.TASKZEN_SIGNING_DIR ?? path.join(home, '.taskzen-android')
const win = process.platform === 'win32'

const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1) }
for (const [label, p] of [['JDK 17', JAVA17], ['SDK de Android', SDK], ['clave de firma', path.join(SIGNING, 'taskzen.keystore')], ['proyecto Android (ejecuta bubblewrap update)', path.join(here, 'gradlew' + (win ? '.bat' : ''))]]) {
  if (!existsSync(p)) fail(`No existe ${label}: ${p}`)
}

// Contraseñas: se leen del archivo privado y solo viajan por variables de entorno (nunca por argumentos).
const secrets = Object.fromEntries(readFileSync(path.join(SIGNING, 'signing.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const env = { ...process.env, JAVA_HOME: JAVA17, ANDROID_HOME: SDK, ANDROID_SDK_ROOT: SDK, KS_PASS: secrets.BUBBLEWRAP_KEYSTORE_PASSWORD, KEY_PASS: secrets.BUBBLEWRAP_KEY_PASSWORD }

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: here, env, stdio: 'inherit', shell: win, ...opts })
  if (r.status !== 0) fail(`Falló: ${cmd} ${args.filter((a) => !a.startsWith('env:')).join(' ')}`)
}

console.log('1/4 Compilando con Gradle (la primera vez descarga dependencias)…')
run(win ? `"${path.join(here, 'gradlew.bat')}"` : path.join(here, 'gradlew'), ['assembleRelease', '--no-daemon', '--console=plain'])

const unsigned = path.join(here, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk')
if (!existsSync(unsigned)) fail(`No se generó ${unsigned}`)

const tools = readdirSync(path.join(SDK, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1)
const bt = path.join(SDK, 'build-tools', tools)
const dist = path.join(here, 'dist')
mkdirSync(dist, { recursive: true })
const aligned = path.join(dist, 'aligned.apk')
const out = path.join(dist, 'TaskZen.apk')

console.log(`2/4 Alineando con zipalign (build-tools ${tools})…`)
run(path.join(bt, win ? 'zipalign.exe' : 'zipalign'), ['-p', '-f', '4', unsigned, aligned])

console.log('3/4 Firmando con apksigner…')
run(path.join(bt, win ? 'apksigner.bat' : 'apksigner'), ['sign', '--ks', path.join(SIGNING, 'taskzen.keystore'), '--ks-key-alias', 'taskzen', '--ks-pass', 'env:KS_PASS', '--key-pass', 'env:KEY_PASS', '--out', out, aligned])

console.log('4/4 Verificando la firma…')
run(path.join(bt, win ? 'apksigner.bat' : 'apksigner'), ['verify', '--verbose', '--print-certs', out])

const sha = createHash('sha256').update(readFileSync(out)).digest('hex')
writeFileSync(path.join(dist, 'TaskZen.apk.sha256'), `${sha}  TaskZen.apk\n`)
console.log(`\n✔ ${out}\n  SHA-256 del archivo: ${sha}`)
