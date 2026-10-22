import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'
import { API_URL } from './config'

/**
 * Mismo Better Auth que la web. La sesión (cookie) vive en el almacén seguro del sistema y se envía
 * en la cabecera `Cookie` a /api/v1. El retorno de los proveedores llega por el enlace `taskzen://`.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: 'taskzen', storagePrefix: 'taskzen', storage: SecureStore })],
})
