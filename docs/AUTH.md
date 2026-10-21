# Acceso y registro

TaskZen no envía correos. Se entra con **Google, Microsoft (Outlook), GitHub, un passkey o usuario y contraseña**.

## Quién puede crear una cuenta
El registro está **cerrado**. Solo se puede crear una cuenta si se cumple una de estas condiciones:

1. **Invitación.** Un administrador de un equipo genera un enlace (`/invite/…`). Al abrirlo, se guarda una cookie de 1 hora y esa persona puede registrarse con cualquier método (contraseña o proveedor). Entra directamente al equipo.
2. **Correo de arranque.** Los correos listados en `BOOTSTRAP_EMAILS` pueden crear cuenta sin invitación, **solo si el proveedor (Google, GitHub) los ha verificado**. Escribir ese correo con contraseña no sirve. Es la forma de crear la primera cuenta.
3. **Registro abierto** con `ALLOW_OPEN_SIGNUP=true`. No recomendado: cualquiera podría registrarse.

Quien ya tiene cuenta entra siempre, esté o no cerrado el registro.

## Variables (`/opt/taskzen/.env` en la VPS, `.env.local` en desarrollo)
```
BOOTSTRAP_EMAILS=tu-correo@gmail.com
GOOGLE_CLIENT_ID=      GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=   MICROSOFT_CLIENT_SECRET=   MICROSOFT_TENANT_ID=common
GITHUB_CLIENT_ID=      GITHUB_CLIENT_SECRET=
```
El botón de cada proveedor solo aparece si sus dos variables están definidas. Tras cambiarlas: `docker compose up -d`.

**URL de retorno** (la misma forma para los tres, cambiando el final):

| Entorno | URL |
|---|---|
| Producción | `https://taskzen.duckdns.org/api/auth/callback/google` · `/microsoft` · `/github` |
| Local | `http://localhost:3000/api/auth/callback/google` · `/microsoft` · `/github` |

## Crear las credenciales
Los nombres de los menús cambian de vez en cuando; la idea es la misma.

### Google
1. [console.cloud.google.com](https://console.cloud.google.com) → crear un proyecto.
2. *APIs y servicios → Pantalla de consentimiento de OAuth* → tipo **Externo**. Pide solo los permisos básicos (correo y perfil).
3. Si lo dejas en modo **Pruebas**, solo podrán entrar los correos que añadas como *usuarios de prueba* (máx. 100). Para abrirlo a cualquiera, pasa a **En producción**: con permisos básicos no exige verificación.
4. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*. Añade la URL de retorno de arriba.

### Microsoft (Outlook, Hotmail y cuentas de trabajo)
1. [entra.microsoft.com](https://entra.microsoft.com) → *Aplicaciones → Registros de aplicaciones → Nuevo registro*.
2. Tipos de cuenta admitidos: **cuentas en cualquier directorio organizativo y cuentas personales de Microsoft**.
3. URI de redirección: tipo **Web**, la URL de retorno de arriba.
4. *Certificados y secretos → Nuevo secreto de cliente*. Copia el **valor** (solo se muestra una vez). El *ID de aplicación (cliente)* es `MICROSOFT_CLIENT_ID`.
5. Microsoft no siempre marca el correo como verificado, así que no sirve para `BOOTSTRAP_EMAILS`: la primera cuenta se crea con Google o GitHub, o con una invitación.

### GitHub
1. *Settings → Developer settings → OAuth Apps → New OAuth App*.
2. *Homepage URL*: la dirección de la web. *Authorization callback URL*: la URL de retorno de arriba.
3. Genera un *client secret*.
4. GitHub entrega el correo principal verificado de la cuenta; ese es el que se compara con `BOOTSTRAP_EMAILS`.

## Passkeys
Cada persona registra los suyos **después de entrar**, desde su perfil (*Añadir un passkey a este dispositivo*), uno por dispositivo. Después puede entrar con la huella, la cara o el PIN.

Quedan ligados al dominio de la web. **Si cambias de dominio, hay que volver a registrarlos** (las demás formas de acceso siguen funcionando).

## Contraseñas y recuperación
- Desde el perfil se puede **cambiar la contraseña** (pide la actual y cierra la sesión en los demás dispositivos) o **crearla** si la cuenta entró con un proveedor.
- Sin correo no hay "olvidé mi clave". Quien la olvide entra con su proveedor o su passkey y la cambia en el perfil. Si no tiene ninguna de las dos cosas, necesita que el administrador del servidor se la restablezca.
