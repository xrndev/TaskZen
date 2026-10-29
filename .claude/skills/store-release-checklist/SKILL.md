---
name: store-release-checklist
description: Lista ordenada para publicar Serenboard en Google Play (TWA) y App Store (Capacitor), con requisitos previos, recursos de la ficha, respuestas de privacidad y riesgos de revisión. Úsala al preparar o revisar una publicación en tiendas.
---
# Lista de publicación en tiendas

Las políticas cambian: **antes de usar esta lista, revisa las guías oficiales del día** (Apple App Review Guidelines, Ayuda de Play Console) y anota la fecha en el informe. Lo marcado "por confirmar" no está verificado.

## Fase 0: requisitos previos comunes (bloquean ambas tiendas)
- [ ] **Dominio propio** estable (hoy es `taskzen.duckdns.org`). Passkeys, Digital Asset Links y Universal Links se atan al dominio; cambiarlo después obliga a rehacerlos y a nuevas versiones.
- [ ] **Borrado de cuenta dentro de la app** (Apple 5.1.1(v); por confirmar en Play): acción de servidor que borra usuario, sesiones, adjuntos del disco, passkeys y los equipos que dejarían de tener administrador.
- [ ] **Política de privacidad y condiciones** públicas (`/privacidad`, `/terminos`) y una **URL de soporte**.
- [ ] Exportación de datos del usuario (recomendable por RGPD).
- [ ] Notificaciones push **opcionales** y con baja (Apple 4.5.4).
- [ ] `node scripts/audit-mobile-readiness.mjs` sin BLOQUEOS.

## Fase 1: Android, vía TWA (recomendada)
Una Trusted Web Activity abre la PWA en Chrome sin barra del navegador. La web es la misma.
- [ ] Cuenta de Google Play (pago único; **por confirmar el importe actual**). Si es cuenta **personal** creada desde noviembre de 2023: prueba cerrada con **12 testers durante 14 días** antes de pedir producción. Una cuenta de organización puede estar exenta (por confirmar).
- [ ] Generar el paquete con Bubblewrap o PWABuilder a partir de `https://<dominio>/manifest.webmanifest`.
- [ ] Servir `/.well-known/assetlinks.json` con la huella SHA-256 de la clave de firma (route handler o `public/.well-known/`).
- [ ] Iconos: 512 px y el `maskable` ya existente; capturas de móvil (y tablet si se declara).
- [ ] Ficha: nombre, descripción corta y larga, categoría (Productividad), clasificación de contenido, **Seguridad de los datos** (por confirmar las preguntas actuales).
- [ ] Probar la app firmada en un Android real: login (contraseña, proveedor, passkey), subida de archivos, push.
- [ ] Reclutar a los 12 testers desde el primer día; el reloj de 14 días no admite atajos.

## Fase 2: iOS (solo si hay valor nativo que justifique el riesgo)
**Riesgo principal (Apple 4.2)**: la app debe elevarse "por encima de un sitio web reempaquetado". Un WebView sin más puede ser rechazado. Aporta funciones nativas reales: push, bloqueo con Face ID/Touch ID, compartir hacia Serenboard, widget.
- [ ] Apple Developer Program (suscripción anual; **por confirmar el importe actual**).
- [ ] Decisión de arquitectura (ADR): `server.url` de Capacitor carga la web remota pero su documentación dice que **no está pensado para producción**; la alternativa soportada es empaquetar la web y hablar con una API (`/api/v1`) sobre los servicios actuales. Elegir con el agente `mobile-architect`.
- [ ] **Apple 4.8**: o se añade Iniciar con Apple, o se ocultan los proveedores sociales en la build de iOS. Interpretación nuestra (confirmar con Apple): mientras se mantengan Google/GitHub/Microsoft, el correo y contraseña propios no cuentan como el "otro servicio" que exige la regla.
- [ ] Si se añade Iniciar con Apple: revocar sus tokens al borrar la cuenta.
- [ ] **OAuth en el navegador del sistema** (ASWebAuthenticationSession) y relevo de sesión con token de un solo uso: las cookies no se comparten con el WKWebView.
- [ ] **Passkeys**: Associated Domains con `webcredentials:<dominio>` y `apple-app-site-association` servido por HTTPS. Probar en iPhone real.
- [ ] Push nativo: capacidad Push Notifications, clave APNs y, si se usa FCM, subirla a Firebase. El plugin de Capacitor no admite notificaciones silenciosas en iOS.
- [ ] Ficha de App Store: capturas por tamaño de pantalla obligatorio, **App Privacy** (etiquetas), URL de privacidad y soporte, cuenta demo para el revisor con datos de ejemplo.
- [ ] TestFlight con testers internos antes de enviar a revisión.

## Alternativa sin tienda para iPhone
Instalar la PWA desde Safari (*Compartir → Añadir a pantalla de inicio*). No requiere cuenta de desarrollador ni revisión y admite Web Push (iOS 16.4+). Es la vía recomendada hasta que haya una razón para pagar la cuenta de Apple y asumir la revisión.

## Antes de enviar a revisión
- [ ] Cuenta demo con datos ficticios y credenciales en las notas de revisión.
- [ ] Capturas sin datos reales de personas.
- [ ] `npm run typecheck && npm run lint && npm test && npm run e2e` y las comprobaciones en dispositivo del agente `mobile-qa`.
- [ ] Plan de reversión: versión anterior disponible y la web intacta (las apps nunca son la única puerta).
