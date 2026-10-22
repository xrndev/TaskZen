const fs = require('node:fs')
const path = require('node:path')

/**
 * Parte de app.json y añade lo de las notificaciones push:
 * - `google-services.json` (descarga de la consola de Firebase) se usa solo si está en esta carpeta; sin él la app
 *   compila igualmente, pero no puede obtener el token de FCM (los ajustes lo avisan).
 * - El plugin de `expo-notifications` fija el canal por defecto y el icono de la barra de estado.
 */
module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json')
  const hasGoogleServices = fs.existsSync(googleServices)

  return {
    ...config,
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins: [
      ...config.plugins,
      ['expo-notifications', { icon: './assets/notification-icon.png', color: '#00ffcc', defaultChannel: 'avisos' }],
    ],
  }
}
