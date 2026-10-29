# Despliegue en la VPS

Estado actual: **https://212-227-98-222.sslip.io** (Ubuntu 24.04, 2 vCPU, 1,8 GB RAM).

## Arquitectura
`Caddy` (80/443, HTTPS automático) → `app` (Next.js standalone, 600 MB máx.) → `postgres:16` (450 MB máx., sin puertos expuestos).
Volúmenes: `pgdata`, `uploads`, `caddy_data`. Todo en `/opt/taskzen`.

## Desplegar una versión nueva
La VPS no compila (se quedaría sin memoria): las imágenes se construyen en local y se suben.

```bash
docker build --target runner  -t taskzen-app:latest .
docker build --target migrate -t taskzen-migrate:latest .
docker save taskzen-app:latest taskzen-migrate:latest | gzip > images.tgz
scp images.tgz root@VPS:/opt/taskzen/
ssh root@VPS 'cd /opt/taskzen && docker load < images.tgz && rm images.tgz && docker compose up -d'
```
`docker compose up -d` ejecuta antes el servicio `migrate`, que aplica las migraciones pendientes (`drizzle/`).
Cambios de esquema: edita `src/db/schema.ts`, `npm run db:generate`, revisa el SQL y súbelo con la imagen.

### Si cambias `deploy/Caddyfile`
El Caddyfile se monta desde `/opt/taskzen/Caddyfile`, no va dentro de la imagen: súbelo y recárgalo.
```bash
scp deploy/Caddyfile root@VPS:/opt/taskzen/Caddyfile
ssh root@VPS 'cd /opt/taskzen && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile'
```
(El límite de subida de 60 MB que admiten los planes depende de este archivo.)

## Variables (`/opt/taskzen/.env`, permisos 600)
`SITE_ADDRESS`, `BETTER_AUTH_URL`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET` (generados en el servidor).
Pantalla de administración de planes (`/admin/planes`, solo lectura): `ADMIN_EMAILS` (ver [PLANES.md](PLANES.md)).
Acceso: `BOOTSTRAP_EMAILS`, `GOOGLE_*`, `MICROSOFT_*`, `GITHUB_*` (ver [AUTH.md](AUTH.md)).
Páginas legales (`/privacidad` y `/terminos`): `LEGAL_OWNER_NAME` y `LEGAL_CONTACT_EMAIL` (obligatorias para que el texto identifique al responsable), y opcionales `LEGAL_OWNER_TAX_ID` y `LEGAL_ADDRESS`. Se leen en cada petición: tras editarlas basta `docker compose up -d`, sin reconstruir la imagen. Estas dos URL son las que pide Google en la pantalla de consentimiento de OAuth y las tiendas de aplicaciones. Opcional: `TRUSTED_ORIGINS`. Dejar `ALLOW_OPEN_SIGNUP` sin definir.
Tras editarlas: `docker compose up -d`.

## Copias de seguridad
`/opt/taskzen/backup.sh` (cron diario 03:17) guarda en `/opt/taskzen/backups/` el volcado SQL y los adjuntos, con rotación de 14 días.

Restaurar la base de datos:
```bash
cd /opt/taskzen
gunzip -c backups/db-AAAAMMDD-HHMMSS.sql.gz | docker compose exec -T postgres psql -U taskzen -d taskzen
```
Pendiente: copiar `backups/` fuera de la VPS (por ejemplo a Cloudflare R2 con `rclone`). Mientras tanto, una avería del disco perdería también las copias.

## Pasar a un dominio propio
1. Apunta un registro A del dominio a la IP de la VPS.
2. En `/opt/taskzen/.env` cambia `SITE_ADDRESS` y `BETTER_AUTH_URL` al nuevo dominio.
3. `docker compose up -d`. Caddy obtiene el certificado solo.

## Operación
```bash
docker compose ps                 # estado
docker compose logs -f app        # logs de la aplicación
docker stats --no-stream          # memoria
```

## Seguridad pendiente en el servidor
- El acceso SSH sigue permitiendo contraseña y `root`. Recomendado: crear clave SSH, comprobar que entra, y poner `PasswordAuthentication no` y `PermitRootLogin prohibit-password` en `/etc/ssh/sshd_config`.
- Rotar la contraseña de root si se ha compartido por algún canal.
