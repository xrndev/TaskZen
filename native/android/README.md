# App de Android (APK)

Es una **Trusted Web Activity**: un envoltorio mínimo que abre `https://taskzen.duckdns.org` en Chrome a pantalla completa, con su icono y sin barra del navegador. **No contiene código de la web**: lo que ves es siempre la última versión desplegada, sin reinstalar. El APK pesa pocos MB.

```
native/android/
├── twa-manifest.json   Configuración (dominio, nombre, colores, paquete). Sin secretos.
├── build.mjs           Compila, alinea y firma → dist/TaskZen.apk
└── (app/, gradle/…)    Proyecto generado. Se ignora en git: se regenera con bubblewrap update.
```

## Construir
Requisitos en el PC: JDK 17, SDK de Android (con `build-tools` y una plataforma) y la **clave de firma** en `C:\Users\<tú>\.taskzen-android\` (`taskzen.keystore` y `signing.env`).

```bash
cd native/android
npx @bubblewrap/cli@1.27.0 update --skipVersionUpgrade --manifest=./twa-manifest.json   # solo si cambias twa-manifest.json
node build.mjs
```
Resultado: `dist/TaskZen.apk` y `dist/TaskZen.apk.sha256`.
(`bubblewrap build` no se usa: exige una disposición del SDK antigua. `build.mjs` hace lo mismo con Gradle, `zipalign` y `apksigner`.)

## Publicar para que otros la descarguen
```bash
scp dist/TaskZen.apk root@<VPS>:/opt/taskzen/downloads/TaskZen.apk
```
Caddy la sirve en `https://<dominio>/descargas/TaskZen.apk`. La página `https://<dominio>/instalar` explica la instalación en Android e iPhone y trae un código QR para compartir.

## La clave de firma
- Vive **fuera del repositorio** (`~/.taskzen-android/`). **Haz una copia de seguridad** (gestor de contraseñas o disco cifrado).
- Si la pierdes, nadie podrá actualizar la app instalada: habría que desinstalar y reinstalar con una clave nueva.
- Si se filtra, alguien podría firmar apps que Android tomaría por la tuya.
- La huella pública (SHA-256) se publica en `/.well-known/assetlinks.json` a partir de la variable `ANDROID_SHA256_FINGERPRINTS` del servidor. Sin ella, la app se abre con la barra del navegador visible.

Ver la huella: `keytool -list -v -keystore ~/.taskzen-android/taskzen.keystore -alias taskzen`

## Cambiar de dominio
El dominio queda fijado dentro del APK (`host` en `twa-manifest.json`). Al pasar a un dominio propio hay que cambiar `host`, `iconUrl`, `webManifestUrl` y `fullScopeUrl`, subir `appVersionCode`, reconstruir y volver a repartir el APK. Se firma con la misma clave, así que se instala encima de la anterior.

## Límites conocidos
- **No está probado en un dispositivo real** desde este repositorio: lo que sí se verifica es el paquete, la firma y el archivo de verificación de dominio.
- Fuera de Google Play, Android puede mostrar el aviso de Play Protect de "app desconocida".
- Requiere Chrome (o un navegador compatible con TWA) en el móvil.
- No sirve para iPhone: ver `/instalar` y `docs/MOBILE-APPS.md`.
