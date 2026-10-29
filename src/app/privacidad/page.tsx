import type { Metadata } from 'next'
import { Ext, LegalPage, List, P, Section, Strong } from '@/components/LegalPage'
import { legalInfo, TERMS_PATH } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos trata Serenboard, para qué, con quién se comparten, cuánto tiempo se conservan y cómo ejercer tus derechos.',
}

// Los datos del responsable se leen del entorno en cada petición.
export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  const info = legalInfo()
  const contact = info.email ? <a href={`mailto:${info.email}`} className="font-medium text-primary underline underline-offset-2">{info.email}</a> : <>la persona que administra este servicio</>

  return (
    <LegalPage
      title="Política de privacidad"
      intro="Serenboard es una aplicación para organizar tareas y proyectos en equipo, disponible en la web y como app para Android. Esta política explica, con claridad, qué datos personales trata, para qué, con quién los comparte y cómo puedes controlarlos."
    >
      <Section id="responsable" title="1. Quién es el responsable">
        <P>
          El responsable del tratamiento es <Strong>{info.owner ?? 'quien presta el servicio'}</Strong>
          {info.taxId ? <> (NIF/CIF {info.taxId})</> : null}
          {info.address ? <>, con domicilio de contacto en {info.address}</> : null}. Puedes escribirle a {contact} para cualquier asunto de privacidad.
        </P>
        <P>El servicio se ofrece en <Strong>{info.site}</Strong> y en la app de Android de Serenboard.</P>
      </Section>

      <Section id="datos" title="2. Qué datos tratamos">
        <List>
          <li>
            <Strong>Datos de tu cuenta:</Strong> nombre, correo electrónico y foto de perfil. Si entras con una contraseña, guardamos solo su
            huella cifrada, nunca la contraseña. Si registras un passkey, guardamos su clave pública.
          </li>
          <li>
            <Strong>Datos que recibimos de Google, Microsoft o GitHub</Strong> si eliges entrar con ellos: tu nombre, tu correo y tu foto. No accedemos
            a tus contactos, archivos, calendarios, repositorios ni a ningún otro dato de esas cuentas.
          </li>
          <li>
            <Strong>Contenido que creas:</Strong> equipos, tareas, descripciones, fechas límite, etiquetas, comentarios, imágenes de portada y archivos
            adjuntos, así como quién creó cada elemento y a quién está asignado.
          </li>
          <li>
            <Strong>Datos de sesión y seguridad:</Strong> un identificador de sesión y, para cada sesión, la dirección IP y el navegador o dispositivo
            desde el que entraste (sirven para que puedas reconocer tus sesiones y para detectar accesos indebidos).
          </li>
          <li>
            <Strong>Notificaciones (solo si las activas):</Strong> un identificador de tu dispositivo (la suscripción de tu navegador o el token de
            Firebase Cloud Messaging de la app), tus preferencias de aviso, tu zona horaria y un registro de los avisos ya enviados para no repetirlos.
          </li>
          <li>
            <Strong>Datos de tu plan:</Strong> el plan que tienes (personal o de equipo), si es una prueba o está activo y su fecha de fin. No guardamos
            datos de tarjeta ni de pago: los pagos en línea aún no están activados.
          </li>
          <li>
            <Strong>Contadores agregados y anónimos:</Strong> cuántas veces al día se alcanza un límite de un plan y cuántas pruebas gratuitas se
            inician. No identifican a nadie y sirven para mejorar los planes.
          </li>
          <li>
            <Strong>Registros técnicos del servidor:</Strong> fecha, ruta solicitada y dirección IP de las peticiones, con rotación automática.
          </li>
        </List>
        <P>No recopilamos datos de localización, contactos, micrófono ni cámara. No usamos analítica, publicidad ni seguimiento de terceros: los únicos contadores son los agregados y anónimos de arriba.</P>
      </Section>

      <Section id="finalidades" title="3. Para qué los usamos y con qué base legal">
        <List>
          <li><Strong>Prestarte el servicio</Strong> (crear tu cuenta, mostrar tus tableros, permitir el trabajo en equipo): ejecución del contrato, art. 6.1.b del RGPD.</li>
          <li><Strong>Enviarte avisos</Strong> de vencimientos y asignaciones: tu consentimiento (art. 6.1.a). Es opcional y puedes retirarlo en cualquier momento desde tu perfil.</li>
          <li><Strong>Mantener la seguridad</Strong> del servicio y prevenir abusos (sesiones, registros técnicos, límites de uso): interés legítimo, art. 6.1.f.</li>
          <li><Strong>Cumplir obligaciones legales</Strong> cuando una norma o una autoridad competente nos lo exija: art. 6.1.c.</li>
        </List>
        <P>No vendemos tus datos, no elaboramos perfiles comerciales y no tomamos decisiones automatizadas que te afecten.</P>
      </Section>

      <Section id="destinatarios" title="4. Con quién se comparten">
        <P>Tu contenido solo es visible para los miembros de los equipos a los que perteneces, según su rol. Además, intervienen estos proveedores:</P>
        <List>
          <li><Strong>IONOS</Strong>, proveedor de alojamiento: el servidor donde se guardan todos los datos. Actúa como encargado del tratamiento.</li>
          <li>
            <Strong>Google, Microsoft y GitHub</Strong>, solo si eliges entrar con ellos: te identifican y nos entregan tu nombre, correo y foto. Su
            tratamiento se rige por sus propias políticas.
          </li>
          <li>
            <Strong>Servicios de notificaciones push</Strong> (Google, Apple, Mozilla o Microsoft, según tu navegador o dispositivo), solo si activas los
            avisos. El aviso incluye el título de la tarea y el tiempo que le queda, y se entrega a través de ellos.
          </li>
          <li>
            <Strong>Cloudflare</Strong> ejecuta un temporizador que avisa al servidor cada pocos minutos de que revise los vencimientos. No recibe datos
            de tus tareas ni de tu cuenta.
          </li>
          <li><Strong>DuckDNS y Let&apos;s Encrypt</Strong> resuelven el nombre de la web y emiten su certificado HTTPS. No reciben datos de tu cuenta.</li>
        </List>
        <P>Solo comunicaremos tus datos a autoridades cuando exista una obligación legal.</P>
      </Section>

      <Section id="transferencias" title="5. Transferencias internacionales">
        <P>
          Los datos se alojan en un servidor de IONOS en la Unión Europea. Google, Microsoft y GitHub, y los servicios de notificaciones, pueden tratar
          datos fuera del Espacio Económico Europeo; lo hacen con las garantías que ellos mismos aplican (decisiones de adecuación, cláusulas
          contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU.). Solo ocurre si decides usar esos servicios.
        </P>
      </Section>

      <Section id="conservacion" title="6. Cuánto tiempo los conservamos">
        <List>
          <li><Strong>Tu cuenta y tu contenido:</Strong> mientras mantengas la cuenta. Si pides su baja, los eliminamos en un máximo de 30 días.</li>
          <li><Strong>Sesiones:</Strong> hasta que caducan o cierras sesión.</li>
          <li><Strong>Datos de tu plan:</Strong> mientras mantengas la cuenta o el equipo al que pertenecen.</li>
          <li><Strong>Dispositivos de notificaciones:</Strong> hasta que los desactivas, cierras sesión en la app o el servicio de push informa de que ya no existen.</li>
          <li><Strong>Copias de seguridad:</Strong> diarias y rotativas; se conservan 14 días y después se eliminan. Un dato borrado puede permanecer en ellas hasta ese momento.</li>
          <li><Strong>Registros técnicos:</Strong> se rotan automáticamente y se conservan solo unos días.</li>
        </List>
        <P>Algunos datos podrán conservarse bloqueados durante los plazos legales de prescripción si una norma lo exige.</P>
      </Section>

      <Section id="cookies" title="7. Cookies y almacenamiento local">
        <P>Usamos únicamente lo estrictamente necesario para que el servicio funcione, por lo que no hace falta pedirte consentimiento:</P>
        <List>
          <li>Una <Strong>cookie de sesión</Strong> para mantenerte identificado.</li>
          <li>Una <Strong>cookie temporal</Strong> (1 hora) al abrir un enlace de invitación, para asociar tu registro a ese equipo.</li>
          <li>Almacenamiento local del navegador para recordar tu <Strong>tema de color</Strong>. En la app, el almacén seguro del móvil guarda tu sesión, tu tema y tu último equipo.</li>
        </List>
        <P>No hay cookies de publicidad, analítica ni de terceros.</P>
      </Section>

      <Section id="seguridad" title="8. Seguridad">
        <P>
          Toda la comunicación va cifrada con HTTPS. Las contraseñas se guardan cifradas de forma irreversible y el acceso a cada equipo y a cada tarea se
          comprueba en el servidor según el rol de la persona. El registro es solo por invitación. Aun así, ningún sistema es infalible: si detectáramos una
          brecha que te afecte, te la comunicaremos y la notificaremos a la autoridad en los plazos que marca la ley.
        </P>
      </Section>

      <Section id="derechos" title="9. Tus derechos">
        <P>Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, limitación del tratamiento, portabilidad y oposición, y retirar tu consentimiento. Cómo hacerlo:</P>
        <List>
          <li><Strong>Rectificar</Strong> tu nombre y tu foto: desde tu perfil.</li>
          <li><Strong>Activar o quitar los avisos</Strong> y cambiar tu contraseña: desde tu perfil.</li>
          <li><Strong>Acceder a tus datos, exportarlos o borrar tu cuenta:</Strong> escribe a {contact} desde el correo de tu cuenta. Responderemos en un máximo de un mes.</li>
        </List>
        <P>
          Si consideras que no tratamos tus datos conforme a la ley, puedes reclamar ante la Agencia Española de Protección de Datos (
          <Ext href="https://www.aepd.es">www.aepd.es</Ext>).
        </P>
      </Section>

      <Section id="menores" title="10. Menores">
        <P>Serenboard no está dirigido a menores de 16 años y no recopilamos a sabiendas datos suyos. Si crees que un menor se ha registrado, avísanos y eliminaremos la cuenta.</P>
      </Section>

      <Section id="cambios" title="11. Cambios en esta política">
        <P>
          Si cambia el tratamiento de tus datos, actualizaremos esta página y su fecha, y te avisaremos cuando el cambio sea relevante. Las condiciones de uso del
          servicio están en <a href={TERMS_PATH} className="font-medium text-primary underline underline-offset-2">Condiciones del servicio</a>.
        </P>
      </Section>
    </LegalPage>
  )
}
