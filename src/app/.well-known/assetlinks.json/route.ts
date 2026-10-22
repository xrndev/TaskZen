/**
 * Digital Asset Links: demuestra a Android que la app firmada con estas huellas es la dueña de este dominio.
 * Con la verificación correcta, la app se abre a pantalla completa sin barra del navegador.
 * Las huellas SHA-256 son públicas (no son secretos); se configuran por entorno.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE || 'io.github.xrndev.taskzen'
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))

  const body = fingerprints.length
    ? [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fingerprints } }]
    : []

  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
