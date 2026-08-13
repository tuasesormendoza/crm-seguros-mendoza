// ─────────────────────────────────────────────────────────────────────────────
// EDE CHANGE REQUEST 109 — VERIFICACIÓN DE IDENTIDAD Y AUTORIZACIÓN DEL AGENTE
//
// Documento de CMS publicado el 03/08/2026 (anunciado el 27/05/2026). Cambia
// cómo el agente inscribe a través de las plataformas EDE del Mercado federal
// a partir del 12/10/2026, justo antes del OEP 2027.
//
// OJO CON EL ALCANCE: esto es del Mercado FEDERAL (FFE y los estados que usan
// la plataforma federal, 29 estados). Georgia tiene mercado propio, así que NO
// le aplica automáticamente. Está escrito así a propósito abajo: un agente de
// Georgia que dé por hecho que le aplica —o que no— se equivoca en los dos
// sentidos, y quien decide es Georgia Access.
//
// Fechas y cifras (12/10/2026, $30, 15 minutos, 3 avisos) están cubiertas por
// pruebas: son las que el agente va a repetir y no pueden torcerse.
// ─────────────────────────────────────────────────────────────────────────────

export const EDE_CR109 = `
CAMBIO IMPORTANTE DEL MERCADO — EDE CR 109 (verificación de identidad y autorización del agente)

QUÉ ES Y CUÁNDO
CMS publicó el 03/08/2026 los detalles de un cambio anunciado el 27/05/2026. Las plataformas EDE (las que usan los agentes para inscribir, tipo HealthSherpa y demás) tienen que aplicarlo A MÁS TARDAR EL 12 DE OCTUBRE DE 2026, para que esté en marcha antes de la Inscripción Abierta de 2027.
Objetivo de CMS: cortar las inscripciones no autorizadas y los cambios de plan a espaldas del cliente.

A QUIÉN LE APLICA
Al Mercado federal (FFE) y a los estados que usan la plataforma federal — 29 estados en total.
GEORGIA NO ESTÁ EN ESE GRUPO: tiene su propio mercado (Georgia Access). Este cambio de CMS no le aplica automáticamente. Si el agente trabaja Georgia, dile que confirme las reglas directamente con Georgia Access en vez de dar por hecho que aplican o que no aplican. Si trabaja además estados federales (Florida, Texas...), ahí sí le aplica de lleno.

LO QUE CAMBIA PARA EL AGENTE — LOS DOS PASOS NUEVOS
1. AUTORIZACIÓN DEL AGENTE (siempre, sin excepción): TODAS las solicitudes van a exigir que el cliente autorice al agente. Sin esa autorización, la plataforma BLOQUEA al agente y no lo deja seguir con la solicitud ni con la inscripción. Se recoge con algo ligero: un código de un solo uso o un enlace de confirmación que se le manda al cliente.
2. VERIFICACIÓN DE IDENTIDAD (solo en casos de "alto riesgo"): en esos casos el titular de la solicitud tiene que verificar su identidad ANTES de que se pueda recoger la autorización del agente.

QUÉ CUENTA COMO "ALTO RIESGO" (basta con UNA de las tres)
• Solicitud de un cliente NUEVO — incluye a quien pide cobertura en un estado distinto al que tenía.
• Cliente con al menos una inscripción activa cuya prima NETA (después del subsidio APTC) sea de $30 AL MES O MENOS. Los planes dentales sueltos no cuentan para esto.
• Cliente que va a trabajar con un agente NUEVO o DISTINTO al que tenía.
Todo lo demás es "bajo riesgo": ahí solo hace falta la autorización del agente, sin verificación de identidad.
Ojo: un mismo caso puede pasar de una categoría a otra. Por ejemplo, si la prima neta sube de $30, o si es el mismo agente de siempre, deja de ser alto riesgo.

CÓMO LLEGA EL AVISO AL CLIENTE
Por mensaje de texto, email o llamada automática, usando los datos de contacto de la solicitud. Reglas que conviene saber para no quedarse esperando:
• Los códigos y enlaces son de UN SOLO USO y CADUCAN A LOS 15 MINUTOS. Avísale al cliente que lo abra en el momento.
• Máximo 3 avisos en 24 horas por cada combinación de agente y solicitud. Si el cliente no responde, la plataforma puede dejar mandar un segundo o tercer aviso a mano, pero de ahí no pasa.

VERIFICACIÓN DE IDENTIDAD: CÓMO FUNCIONA Y QUÉ HACER SI FALLA
Se hace con el servicio Experian (RIDP RBA) de CMS, o con otro servicio aprobado por CMS que cumpla el estándar NIST 800-63-4 nivel IAL2.
Si el cliente NO pasa la verificación, tiene tres caminos:
1. Llamar a la mesa de ayuda de Experian por teléfono (la plataforma le da un número de referencia y el contacto).
2. Usar otro servicio de verificación aprobado, si la plataforma lo ofrece.
3. Entrar por CuidadoDeSalud.gov, crear su cuenta y subir sus documentos para revisión manual.
Mientras no se complete la verificación y la autorización, el agente sigue BLOQUEADO. La plataforma tiene que indicar en pantalla cuándo puede continuar.

ESTO NO SUSTITUYE AL CONSENTIMIENTO — SIGUEN SIENDO DOS COSAS
La autorización del agente NO reemplaza el consentimiento del cliente, que sigue siendo obligatorio por el reglamento 45 CFR 155.220(j)(2)(iii).
Y el orden importa: el consentimiento hay que recogerlo y documentarlo ANTES de acceder a la información del cliente o incluso de BUSCARLO en la plataforma. La autorización viene después, dentro del proceso.
Si el agente sospecha que alguien está buscando o inscribiendo clientes sin consentimiento, se reporta a FFMProducerAssisterHelpDesk@cms.hhs.gov.

DATOS DE CONTACTO — LA REGLA QUE MÁS PROBLEMAS DA
El teléfono y el email de la solicitud tienen que ser del CLIENTE y él tiene que poder entrar a ellos, porque por ahí le llegan el código y la verificación.
PROHIBIDO, y CMS lo dice expresamente: el agente NUNCA puede poner su propio email, teléfono o dirección (ni personal, ni profesional, ni de la compañía) en la solicitud de un cliente. Tampoco valen direcciones ni teléfonos inventados o "de relleno".
Si es cliente nuevo: hay que conseguirle un teléfono y un email suyos de verdad desde el principio.
Si es cliente de años y tiene los datos viejos o mal, hay dos salidas:
• Que el cliente llame él mismo al Marketplace Call Center a actualizarlos — SIN el agente en la línea.
• Que meta una solicitud por la vía del consumidor (CuidadoDeSalud.gov o una plataforma EDE de consumidor) con sus datos correctos.
Consejo práctico: aprovecha AHORA, antes de octubre, para repasar teléfono y email de toda tu cartera. Es lo que más va a atascar el OEP 2027.

CUÁNTO DURA CADA COSA
• Verificación de identidad: puede quedar permanente en una plataforma si el cliente tiene cuenta ahí y su verificación está ligada a esa cuenta. Sin cuenta, hay que rehacerla cada año de cobertura.
• Autorización del agente: se recoge CADA AÑO DE PLAN, incluso con clientes de toda la vida que ya tengan cuenta. Dura ese año de plan, o hasta que el cliente autorice a otro agente.
Consecuencia: la mayoría de tus clientes de siempre van a tener que volver a autorizarte durante la Inscripción Abierta de 2027.

SE PUEDE ADELANTAR TRABAJO
CMS espera que los agentes puedan ir verificando la identidad de sus clientes ANTES del OEP 2027, según lo que permita cada plataforma — por ejemplo ayudándoles a crear su cuenta y verificarse para que quede permanente. La autorización, en cambio, va por año de plan, así que esa casi todos tendrán que renovarla en el OEP.

DOCUMENTOS DE DMI Y SVI
Subir documentos por el cliente para resolver un DMI (problema de coincidencia de datos) o un SVI (verificación de periodo especial) TAMBIÉN exige la autorización del agente, si no la tenía ya.
Y solo puede haber UN agente asociado a una solicitud a la vez.

SE ACABA EL ERROR "InvalidAction" Y LAS LLAMADAS A TRES
Desde julio de 2024, un agente nuevo no podía tocar la inscripción de un cliente sin una llamada a tres con el Marketplace. Para el OEP 2027, CMS ELIMINA ese bloqueo (el error InvalidAction) y también la función de "cambio de vía" de las plataformas. Ya no hará falta: con el cliente verificado y el agente autorizado, el agente puede hacer por la vía EDE lo que antes exigía la llamada a tres, incluidos los cambios de plan.

EL CALL CENTER DEJA DE HACER ESTO POR TI
Desde el OEP 2027 en adelante, el Marketplace Call Center YA NO va a aceptar cambios ni envíos de solicitudes o inscripciones pedidos por un agente. Todo eso pasa a hacerse por la plataforma EDE con el cliente verificado y el agente autorizado. Si un agente cuenta con llamar al Call Center para resolver un caso, dile que ese camino se cierra.

CÓMO PREPARARSE (dilo cuando el agente pregunte qué hacer)
1. Repasar y corregir teléfono y email de todos los clientes activos — que sean suyos y que puedan entrar a ellos.
2. Avisarles de que van a recibir un código o enlace y que caduca en 15 minutos.
3. Seguir documentando el consentimiento como siempre: eso no cambia y va primero.
4. Contar con que casi toda la cartera tendrá que volver a autorizar al agente durante el OEP 2027.
5. Si trabaja Georgia, confirmar aparte con Georgia Access qué aplica allí.
`
