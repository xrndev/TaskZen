import type { Metadata } from 'next'
import { LegalPage, List, P, Section, Strong } from '@/components/LegalPage'
import { legalInfo, PRIVACY_PATH } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Condiciones del servicio · Serenboard',
  description: 'Las reglas de uso de Serenboard: acceso, uso aceptable, contenido, disponibilidad y responsabilidad.',
}

// Los datos del responsable se leen del entorno en cada petición.
export const dynamic = 'force-dynamic'

export default function TermsPage() {
  const info = legalInfo()
  const contact = info.email ? <a href={`mailto:${info.email}`} className="font-medium text-primary underline underline-offset-2">{info.email}</a> : <>la persona que administra este servicio</>

  return (
    <LegalPage
      title="Condiciones del servicio"
      intro="Estas condiciones regulan el uso de Serenboard, la aplicación web y Android para organizar tareas y proyectos en equipo. Al crear una cuenta o usar el servicio las aceptas; si no estás de acuerdo, no lo utilices."
    >
      <Section id="quien" title="1. Quién presta el servicio">
        <P>
          Serenboard es prestado por <Strong>{info.owner ?? 'la persona que administra este servicio'}</Strong>
          {info.taxId ? <> (NIF/CIF {info.taxId})</> : null}, accesible en <Strong>{info.site}</Strong>. Puedes contactar en {contact}.
        </P>
      </Section>

      <Section id="cuenta" title="2. Tu cuenta">
        <List>
          <li>El registro es <Strong>solo por invitación</Strong> de quien administra un equipo, o por el acceso que habilite el administrador del servicio.</li>
          <li>Debes tener al menos <Strong>16 años</Strong> y facilitar datos veraces.</li>
          <li>La cuenta es personal: no la compartas. Eres responsable de la actividad realizada con tus credenciales y de mantenerlas seguras. Avísanos de inmediato si sospechas un acceso indebido.</li>
          <li>Puedes entrar con una contraseña, un passkey o con tu cuenta de Google, Microsoft o GitHub. El uso de esos proveedores se rige también por sus condiciones.</li>
        </List>
      </Section>

      <Section id="equipos" title="3. Equipos y roles">
        <P>
          El contenido se organiza en equipos. Quien administra un equipo puede invitar o expulsar a miembros, cambiar sus roles y borrar el equipo, y los
          miembros pueden ver y, según su rol, modificar lo que se publica en él. Antes de compartir algo en un equipo, ten en cuenta quién forma parte de
          él. Cuando un administrador elimina un equipo o te expulsa, pierdes el acceso a su contenido.
        </P>
      </Section>

      <Section id="uso" title="4. Uso aceptable">
        <P>Te comprometes a usar el servicio de forma lícita y respetuosa. Queda prohibido:</P>
        <List>
          <li>Subir o publicar contenido ilegal, que vulnere derechos de terceros (propiedad intelectual, intimidad, honor) o que sea difamatorio, discriminatorio o violento.</li>
          <li>Subir virus, código malicioso o cualquier archivo destinado a dañar sistemas.</li>
          <li>Intentar acceder a cuentas, equipos o datos que no te corresponden, eludir las medidas de seguridad o los límites de uso.</li>
          <li>Sobrecargar el servicio con peticiones automatizadas, hacer scraping o ingeniería inversa para fines abusivos.</li>
          <li>Usar el servicio para enviar spam o para hostigar a otras personas.</li>
        </List>
        <P>El servicio tiene límites técnicos (por ejemplo, el tamaño máximo por archivo y el espacio total de cada plan, descritos en la página de planes, y los tipos de archivo permitidos) que pueden ajustarse.</P>
      </Section>

      <Section id="contenido" title="5. Tu contenido">
        <P>
          Lo que creas en Serenboard (tareas, comentarios, archivos…) sigue siendo tuyo. Nos concedes únicamente el permiso necesario para alojarlo, procesarlo y
          mostrarlo a los miembros de tus equipos con el fin de prestar el servicio. Eres responsable de que tengas derecho a publicarlo. Podemos retirar
          contenido o suspender una cuenta cuando incumpla estas condiciones o lo exija la ley.
        </P>
      </Section>

      <Section id="propiedad" title="6. Propiedad intelectual">
        <P>
          El software, el diseño y la marca Serenboard pertenecen a su titular. Estas condiciones no te transfieren ningún derecho sobre ellos más allá del uso
          del servicio tal y como se ofrece.
        </P>
      </Section>

      <Section id="notificaciones" title="7. Avisos y notificaciones">
        <P>
          Los recordatorios y avisos son opcionales y se envían con el mejor esfuerzo. Dependen de servicios externos (los de tu navegador o de Google) y de la
          configuración de tu dispositivo, como el ahorro de batería, por lo que <Strong>no podemos garantizar que lleguen siempre ni a tiempo</Strong>. No los
          uses como único medio para cumplir plazos críticos.
        </P>
      </Section>

      <Section id="planes" title="8. Planes, pruebas y límites">
        <List>
          <li>
            Serenboard ofrece un <Strong>plan gratuito sin caducidad</Strong> y planes de pago, personales y de equipo, con límites distintos (miembros por
            equipo, espacio de adjuntos, equipos propios, recordatorios antes del vencimiento y exportación de datos). Lo que incluye cada uno se describe en la página de planes.
          </li>
          <li>
            Los planes de pago pueden probarse <Strong>14 días gratis, una sola vez por persona o por equipo</Strong>, sin facilitar datos de pago. Al terminar la
            prueba se vuelve al plan gratuito automáticamente.
          </li>
          <li>
            A fecha de estas condiciones <Strong>los pagos en línea no están activados</Strong>. Antes de cobrar nada se informará del precio, los impuestos, la
            periodicidad y cómo cancelar, y estas condiciones se actualizarán.
          </li>
          <li>
            Bajar de plan o terminar una prueba <Strong>no borra tu contenido</Strong>: solo impide superar los límites del plan gratuito (por ejemplo, añadir
            miembros o subir más archivos).
          </li>
          <li>Las funciones marcadas como «Próximamente» son una intención, no un compromiso, y pueden cambiar o no llegar a ofrecerse.</li>
        </List>
      </Section>

      <Section id="disponibilidad" title="9. Disponibilidad y copias de seguridad">
        <P>
          El servicio se ofrece «tal cual», sin garantía de disponibilidad continua: puede haber interrupciones por mantenimiento, fallos o causas ajenas. Hacemos
          copias de seguridad diarias que se conservan 14 días, pero no garantizamos la recuperación de un dato concreto. Te recomendamos guardar por tu cuenta lo
          que sea importante. Podemos modificar, ampliar o retirar funciones; si el cambio te perjudica de forma relevante, lo avisaremos con antelación razonable.
        </P>
      </Section>

      <Section id="responsabilidad" title="10. Responsabilidad">
        <P>
          En la medida que permita la ley, no respondemos de los daños indirectos, de la pérdida de datos o de beneficios derivados del uso o de la
          imposibilidad de usar el servicio, ni del contenido que publiquen otras personas. Esto no limita la responsabilidad que no pueda excluirse legalmente
          (por ejemplo, por dolo o negligencia grave) ni los derechos que te corresponden como consumidor.
        </P>
      </Section>

      <Section id="baja" title="11. Baja y suspensión">
        <P>
          Puedes dejar de usar el servicio cuando quieras y pedir la baja de tu cuenta escribiendo a {contact}. Podemos suspender o cancelar una cuenta si se
          incumplen estas condiciones, si hay riesgo para la seguridad o si lo exige una autoridad. Tras la baja, tus datos se tratan como indica la{' '}
          <a href={PRIVACY_PATH} className="font-medium text-primary underline underline-offset-2">Política de privacidad</a>.
        </P>
      </Section>

      <Section id="datos" title="12. Protección de datos">
        <P>
          El tratamiento de tus datos personales se describe en la{' '}
          <a href={PRIVACY_PATH} className="font-medium text-primary underline underline-offset-2">Política de privacidad</a>, que forma parte de estas condiciones.
        </P>
      </Section>

      <Section id="cambios" title="13. Cambios en estas condiciones">
        <P>
          Podemos actualizar estas condiciones. Publicaremos la nueva versión con su fecha y, si el cambio es relevante, te lo avisaremos. Si sigues usando el
          servicio después, entendemos que las aceptas; si no estás de acuerdo, puedes pedir la baja.
        </P>
      </Section>

      <Section id="ley" title="14. Ley aplicable y jurisdicción">
        <P>
          Estas condiciones se rigen por la legislación española. Si eres consumidor, podrás acudir a los juzgados y tribunales de tu domicilio; en otro caso, a los
          de la ciudad del responsable del servicio. Si alguna cláusula resultara inválida, el resto seguirá en vigor.
        </P>
      </Section>
    </LegalPage>
  )
}
