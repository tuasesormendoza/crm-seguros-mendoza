// ─────────────────────────────────────────────────────────────────────────────
// WASHINGTON NATIONAL — VERIFICACIÓN VISUAL Y OBTENCIÓN DE FIRMA
//
// Fuente: presentación WN-3247-FB-SP-1026 «Application Verification and
// Signature Acquisition» (inglés y español), octubre 7 de 2026. Aplica a todos
// los productos de CNO / Washington National.
//
// Usa este bloque cuando el agente pregunte sobre cómo hacer el proceso de
// solicitud de Washington National: verificar la identidad del cliente, obtener
// la firma electrónica o en papel, usar CrankWheel, o cuáles herramientas están
// permitidas o prohibidas.
// ─────────────────────────────────────────────────────────────────────────────

export const WN_VERIFICACION = `
PROCESO DE SOLICITUD WASHINGTON NATIONAL — VERIFICACIÓN E IDENTIDAD Y FIRMA

CUÁNDO APLICA
Esto aplica a TODOS los productos de seguro de las compañías CNO / Washington National que el agente venda.

─── PARTE 1: VERIFICACIÓN VISUAL E IDENTIFICACIÓN ─────────────────────────────

PÓLIZAS DE VIDA (obligatorio)
Para TODOS los productos de vida de Washington National el agente DEBE:
• Confirmar visualmente quién es el titular de la póliza solicitante y el asegurado.
• Verificar la identificación del titular revisando un documento de identidad aprobado.
Excepciones donde NO hace falta: centros de llamadas verificados y aprobados por la oficina central, y ventas en el lugar de trabajo (worksite) por auto-inscripción.

PÓLIZAS DE SALUD SUPLEMENTARIA (recomendado, no obligatorio)
La verificación visual se recomienda pero no es exigida. El agente debe usar la plataforma de solicitud aprobada por la oficina central.

DOCUMENTOS DE IDENTIDAD ACEPTABLES
• Licencia de conducir de EE.UU. (vigente, no vencida)
• Pasaporte de EE.UU. (vigente, no vencido)
• Identificación gubernamental de EE.UU. con foto (vigente)
• Identificación de empleador de EE.UU. con foto (vigente)
• Otra identificación con foto: identificación escolar en EE.UU. o tarjeta de crédito emitida por un banco de EE.UU.

HERRAMIENTAS APROBADAS PARA VERIFICACIÓN VIRTUAL
Si la cita no es en persona, el agente puede confirmar la identidad usando:
Google Meet, WhatsApp, Microsoft Teams, Zoom, WebEx o CrankWheel.
Las solicitudes deben enviarse igual por el sistema aprobado (OneSource) o en papel.

REGLA CLAVE: solo hace falta verificar la identidad visualmente para seguros de VIDA. Para salud suplementaria se recomienda pero no es requisito. El agente NO necesita adjuntar una copia del documento a la solicitud; es suficiente con que él mismo haya verificado.

─── PARTE 2: OBTENCIÓN DE FIRMA ──────────────────────────────────────────────

REGLAS GENERALES (todas las solicitudes)
• El titular/solicitante DEBE firmar la solicitud personalmente, sea electrónica o en papel.
• El agente tiene PROHIBIDO firmar en nombre del cliente, incluso con permiso.
• Los procesos de firma por voz solo están permitidos con sistemas pre-aprobados por la oficina central.
• Si no hay internet: usar solicitud en PAPEL. Bajo NINGUNA circunstancia se transcriben datos de una solicitud firmada en papel a una electrónica.
• Las solicitudes en papel completadas se envían a CRDHelpdesk@cnoinc.com o por fax al 317-817-5562.

EL PIN DEL CLIENTE (cómo funciona la firma electrónica en OneSource)
El cliente firma electrónicamente escribiendo su PIN: los 4 últimos dígitos del SSN + los 2 últimos dígitos del año de nacimiento. Luego hace clic en "Sign Form" (o "Firmar formulario").
Nunca ingresar el PIN el agente — solo el cliente.

PROCESO PASO A PASO SEGÚN EL TIPO DE VENTA

▸ VENTA EN PERSONA (face-to-face)
  - Papel: obtener firma manuscrita (wet signature).
  - Electrónica (OneSource): completar la solicitud, darle acceso al teclado/dispositivo al cliente, él escribe su PIN y hace clic en "Sign Form".

▸ VENTA REMOTA (electrónica, OneSource)
  1. El agente necesita acceso a una plataforma de compartición de pantalla aprobada.
  2. Compartir la pantalla con el cliente para que pueda revisar la solicitud.
  3. Cuando se llega a la sección "Review & Sign", el agente hace clic en "Grant Control" (Otorgar control).
  4. Aprobar el mensaje de confirmación de asistencia remota.
  5. El cliente selecciona "Yes" para habilitar el control remoto y luego "Show window".
  6. El agente selecciona el área donde el cliente ingresará su PIN y hace clic en "Grant control of selected area".
  7. El cliente escribe su PIN y hace clic en "Sign Form".
  8. El agente hace clic en "End Remote Control" para detener el control remoto.
  9. Completar el envío de la solicitud en OneSource como de costumbre.

PLATAFORMAS APROBADAS para ventas remotas / compartición de pantalla:
Microsoft Teams, Zoom, WebEx y CrankWheel.

PLATAFORMAS PROHIBIDAS (no usar bajo ninguna circunstancia):
VNC Viewer, Tiny VNC, TightVNC, TeamViewer, ScreenConnect, DWService, FixMe.It, Remote Desktop.

─── PARTE 3: CRANKWHEEL — HERRAMIENTA RECOMENDADA ────────────────────────────

QUÉ ES CRANKWHEEL
Una plataforma de compartición de pantalla diseñada para facilitar la firma electrónica de solicitudes. El cliente puede acceder desde cualquier dispositivo: Windows, iOS, Android, tableta o escritorio. Los agentes actualmente requieren Windows (iOS estará disponible próximamente).

PASOS EN CRANKWHEEL
1. El agente comparte su pantalla con el cliente desde CrankWheel.
2. Completa la solicitud en OneSource hasta llegar a "Review & Sign".
3. Hace clic en "Grant Control" y aprueba el control de asistencia.
4. El cliente hace clic en "Yes" para habilitar el control remoto, luego en "Show window".
5. El agente selecciona el área del PIN y hace clic en "Grant control of selected area".
6. El cliente escribe su PIN y hace clic en "Sign Form".
7. El agente hace clic en "End Remote Control".
Más información y demostración en: https://crankwheel.com/screen-sharing-guide/

BUENAS PRÁCTICAS DE CRANKWHEEL
• Practicar con un colega o familiar antes de la primera venta real.
• Confirmar siempre que es el solicitante quien ingresa el PIN — nunca el agente.
• Usar CrankWheel solo cuando el solicitante esté presente y haya dado su consentimiento.
• Nunca ingresar el PIN en nombre del solicitante.

─── PARTE 4: BUENAS PRÁCTICAS DE COMPARTICIÓN DE PANTALLA ───────────────────

• Compartir solo el contenido necesario.
• Cerrar sesión y cerrar la aplicación al terminar, antes de volver a compartir.
• Iniciar sesión en OneSource antes de compartir pantalla (no mostrar contraseñas).
• Compartir pantallas específicas, no el escritorio completo.
• No reutilizar sesiones o enlaces.
• No grabar las sesiones (difícil almacenar de forma segura).
• Usar contraseñas complejas (más de 10 caracteres, con mayúsculas, minúsculas, números y al menos un carácter especial).
• Cambiar contraseñas con frecuencia (cada 180 días o menos).
• Activar actualizaciones automáticas del software.
• No dejar sesiones abiertas sin supervisión.

─── PARTE 5: UBICACIÓN DE LA SESIÓN ─────────────────────────────────────────

En OneSource, la "Session location" debe coincidir con el lugar donde el solicitante está firmando la solicitud en ese momento — puede ser diferente a su dirección de residencia. Si hay discrepancia, Washington National puede solicitar al agente una aclaración posterior.

─── PARTE 6: CONDUCTAS PROHIBIDAS Y CONSECUENCIAS ───────────────────────────

NUNCA está permitido:
• Firmar el nombre o las iniciales de otra persona en cualquier documento, incluso con su permiso.
• Proporcionar respuestas falsas o incompletas, o datos personales incorrectos.
• Enviar solicitudes para personas ficticias o sin su conocimiento y consentimiento.
• Modificar una solicitud sin las iniciales del cliente cuando el proceso aprobado las requiere.

Consecuencias del incumplimiento: terminación del contrato, pérdida de licencia. Si hay sospecha de fraude, las autoridades pueden iniciar acciones penales.

Este material es solo para información de agentes (WN-3247-FB-SP-1026). No distribuir al público ni usar en actividades de captación de clientes.
`
