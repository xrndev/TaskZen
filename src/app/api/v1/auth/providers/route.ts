export const dynamic = 'force-dynamic'

/** Proveedores de acceso configurados en este servidor (los mismos que muestra el login web). Público. */
export function GET() {
  const providers = [
    ...(process.env.GOOGLE_CLIENT_ID ? ['google'] : []),
    ...(process.env.MICROSOFT_CLIENT_ID ? ['microsoft'] : []),
    ...(process.env.GITHUB_CLIENT_ID ? ['github'] : []),
  ]
  return Response.json({ data: providers })
}
