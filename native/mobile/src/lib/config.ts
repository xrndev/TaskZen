/** Servidor de TaskZen. Se cambia con EXPO_PUBLIC_API_URL al compilar (por ejemplo para probar en local). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://taskzen.duckdns.org').replace(/\/$/, '')
