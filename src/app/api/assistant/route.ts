import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { DEFAULT_RATES } from '@/lib/commissions'
import { getPlatformSetting } from '@/lib/platform'
import { ACA_KNOWLEDGE } from '@/lib/acaKnowledge'
import { EDE_CR109 } from '@/lib/edeCr109'

// ─────────────────────────────────────────────────────────────────────────────
// Asistente virtual del CRM — POST /api/assistant
//
// Recibe el historial del chat y responde usando Claude con "tool calling":
// el modelo decide qué herramienta de SOLO LECTURA invocar (buscar clientes,
// renovaciones, agenda, comisiones, estadísticas) y este servidor la ejecuta
// contra la base de datos SIEMPRE filtrada por la agencia del usuario logueado.
//
// Privacidad: las herramientas NUNCA seleccionan campos sensibles (SSN, cuentas
// bancarias, contraseñas de portal). El modelo solo ve datos operativos.
// El rol "assistant" no tiene acceso a la herramienta de comisiones (misma
// regla que la página de Comisiones).
// ─────────────────────────────────────────────────────────────────────────────

const MODEL = 'claude-haiku-4-5'
const MAX_TOOL_ITERATIONS = 5
const MAX_HISTORY = 12

// ── Guía del CRM para el "modo instructor" ────────────────────────────────────
// Cuando el usuario pregunta CÓMO hacer algo, el asistente responde con los
// nombres exactos de secciones, botones y pasos según esta guía.
const CRM_GUIDE = `
REGLA IMPORTANTE DEL NEGOCIO — SUBSIDIO ACA DESDE EL 01/01/2027:
A partir del 1 de enero de 2027, SOLO los ciudadanos americanos y los residentes permanentes (Green Card) califican para el crédito fiscal (APTC/subsidio). Todos los demás estatus migratorios (Asilo, Refugiado, TPS, Parole, Visa U/T, VAWA, EAD, DACA, sin estatus, visas de trabajo/estudiante, etc.) PUEDEN inscribirse en un plan del Mercado, pero pagan el PRECIO COMPLETO, sin subsidio.
El CRM avisa de esto automáticamente: en el perfil del cliente (banner rojo si pierde el subsidio, amarillo si falta registrar su estatus migratorio), en la Calculadora APTC (muestra el precio completo que pagaría), en el Dashboard (cuántos clientes se ven afectados) y en Campañas (segmento rápido "🚫 Pierden subsidio 2027" + plantilla "Cambio subsidio 2027" para avisarles). También existe la etiqueta "Sin subsidio 2027" (roja) para marcar a estos clientes y filtrarlos en la lista de Clientes; en el Dashboard hay un botón "🏷️ Etiquetar a los afectados" que se la pone a todos de una vez. Si el agente pregunta por esto, explícale la regla y recomiéndale usar ese segmento para contactar a los afectados con tiempo.

PRIMER PASO AL EMPEZAR — COMPLETAR EL PERFIL:
El CRM llega SIN datos de ningún agente precargados: nombre, teléfono, WhatsApp, link de reseñas de Google y página web nacen vacíos a propósito, para que nadie envíe mensajes firmados con el nombre de otra persona ni pida reseñas para el negocio de otro. Hasta que el agente los rellene, aparece un aviso amarillo "Completa tu perfil" en Configuración (con la lista exacta de lo que falta), y también en Campañas, Referidos, Reportes y Tarjeta de Plan. Mientras tanto:
 - Donde iría el nombre se pone "Tu Asesor de Seguros", y en la barra lateral sale "Completa tu perfil" en vez de un nombre.
 - Sin link de reseñas de Google NO aparece el botón "💬 Enviar link por WhatsApp" (ni en el Dashboard ni en la ficha del cliente): se muestra en su lugar "⚠️ Añade tu link de reseñas", porque sin link no hay nada que enviar.
 - Sin página web se OMITE la línea de la web en los documentos, en el pie de la Tarjeta de Plan y en los correos.
Dónde se rellena: nombre, teléfono y WhatsApp en Configuración → Perfil y Metas → Perfil del Agente; el link de reseñas en Configuración → Mensajería → Google Review; la página web en Configuración → Marca → Tarjeta de Plan. Si el agente pregunta por qué algo sale vacío o sin su nombre, revisa primero si tiene el perfil completo.

GUÍA DEL CRM (menú lateral izquierdo). Usa los nombres EXACTOS de secciones y botones al explicar cómo hacer algo:

• Dashboard (inicio): KPIs del negocio, barras de objetivos de producción y alertas.

• Hoy: citas de hoy, cumpleaños de la semana (botón de WhatsApp para felicitar), clientes con primera prima sin pagar y seguimientos pendientes.

• Clientes: lista con buscador y filtros (estatus, aseguradora, estado, etiqueta, WN).
  REGISTRAR UN CLIENTE: botón "+ Nuevo Cliente" (arriba a la derecha) → llenar Datos Personales (incluye Estatus Migratorio con categorías del Marketplace: Ciudadano, Residente Permanente, Asilo, TPS, DACA, Sin estatus, etc.), Dirección, Póliza ACA (aseguradora, plan, Precio ACA, Crédito Fiscal Otorgado), Dependientes (botón "+ Agregar dependiente"), Washington National si aplica, datos bancarios y portal → "Guardar".
  VER/EDITAR: clic en el nombre del cliente → su perfil tiene botón Editar y estas secciones:
   - Citas Médicas: agenda la cita del cliente con su médico primario o especialista (fecha/hora, nombre del médico y dirección del consultorio). Cada cita trae un botón "💬 Confirmar por WhatsApp" que le envía al cliente la fecha, el médico y la dirección.
   - Actividades: registra interacciones — tipos: Nota, Llamada, Mensaje de Texto, WhatsApp, Email, Documento, Reunión, Otro.
   - Documentos: sube archivos por categoría (Identificación, Póliza, Banco, Email, Factura Médica, etc.).
   - Washington National: además del tipo y monto de cada póliza, guarda el Número de Póliza por tipo y el Día de cobro de la mensualidad.
   - Google Review: la barra de etapas es TOCABLE — toca la etapa (Pendiente → Enviada → Esperando al cliente → Realizada) para actualizar el avance al instante, sin entrar a Editar.
   - También: Historial de Pólizas, Historial de Aseguradoras y Encuestas.

• Pipeline: tablero de prospectos por etapas (Nuevo → Contactado → Cotizado → Cerrado-Ganado/Perdido); se arrastran las tarjetas entre columnas. Incluye "Modo Combate" para cotización rápida con el link de consentimientos de HealthSherpa (ese link se configura en Configuración → Perfil y Metas).

• Oportunidades (venta cruzada): detecta clientes ACTIVOS a los que les falta un producto complementario. Dos listas: "Sin Dental" y "Sin Washington National". Cada cliente trae botones de 💬 WhatsApp y 📧 Email con un mensaje de oferta ya redactado. ÚSALA para vender dental o WN a quienes ya son clientes.

• Reseñas (⭐ Reseñas de Google, justo debajo de Campañas): dice quién ya dejó su reseña, quién falta y en qué punto está cada uno. Arriba, una barra de progreso con el porcentaje de clientes que ya la dejaron y cuatro tarjetas con las etapas — 📋 Pendiente, 📤 Enviada, ⏳ Esperando, ⭐ Realizada — que se PULSAN para filtrar la lista. Debajo, cada cliente con: un selector para cambiarle la etapa (se guarda solo, sin botón de guardar) y un botón verde de WhatsApp que abre el chat con el mensaje ya escrito y el enlace de reseña puesto. El texto cambia según la etapa: si está Pendiente dice "Pedir reseña" y usa la plantilla normal; si ya se le mandó, dice "Recordar" y usa la de recordatorio. A quien ya la dejó NO se le ofrece enviar nada. Al mandar el WhatsApp desde una etapa Pendiente, el CRM la pasa a "Enviada" solo. Hay buscador por nombre o teléfono, una casilla "Ocultar cancelados" (activada por defecto, para no pedirle reseña a quien se fue) y un botón "🔗 Copiar enlace de reseña". Las plantillas y el enlace salen de Configuración → Mensajería; si falta el enlace, la página avisa en amarillo. La misma etapa se puede cambiar también desde la ficha del cliente.
• Campañas: envío masivo de emails con DISEÑO DE MARCA (no texto plano) a un segmento de clientes.
  CÓMO ENVIAR UNA CAMPAÑA: 1) En "¿A quién?" elige el segmento (por estatus, estado, etiqueta, con/sin WN, o "un cliente específico" buscándolo por nombre). 2) Opcional: usa una "✨ Plantilla rápida" (Inscripción Abierta, Renovación, Plan Dental, Cumpleaños, Reseña Google, Bienvenida) para llenar todo con un clic. 3) Escribe el Asunto y el Mensaje. El editor tiene formato (negrita **texto**, cursiva *texto*, viñetas con "- ", y los enlaces se activan solos) y VARIABLES INTELIGENTES que se reemplazan con los datos reales de cada cliente: {nombre}, {aseguradora}, {plan}, {estado}, {agente}, {telefono}, {reseña} — insértalas con el botón "+ Insertar variable". Puedes adjuntar hasta 3 imágenes y agregar un "Botón de acción" (texto + enlace, ej. "Cotiza ahora"). El MENSAJE es OPCIONAL si agregas al menos una imagen: puedes enviar una campaña SOLO con imágenes (un volante/flyer), solo hace falta el asunto. 4) "✉️ Enviar prueba a mí" te manda el correo a tu propia bandeja para revisarlo, y "👁 Vista previa" lo muestra con tu logo/nombre, colores de marca, el botón y tus datos de contacto. 5) "Enviar campaña" (máximo 60 por envío; solo a clientes con email). También "Guardar borrador". En "🗂 Mis campañas" cada una se puede Editar/Reenviar, Duplicar (📋) o borrar, y muestra las aperturas aprox. (👁). El diseño (logo, colores, contacto) sale de Configuración → Marca y Perfil.
  SEGMENTOS RÁPIDOS: chips de un clic — "Renuevan en 60 días", "Cumplen este mes", "Sin reseña de Google".
  PROGRAMAR: en "3. Enviar" hay un campo "📅 Programar envío" — elige fecha/hora y la campaña se envía sola en ese momento.
  CAMPAÑAS AUTOMÁTICAS: abajo, actívalas una vez y se disparan solas — Cumpleaños (el día del cumpleaños del cliente), Renovación (X días antes de su renovación) y Bienvenida (al registrar un cliente nuevo). Cada cliente la recibe una sola vez por evento.
  MIS CAMPAÑAS: abajo está el historial; cada campaña se puede Editar, Reenviar o borrar. Requiere el email configurado en Configuración → Mensajería → Notificaciones por Email.

• Reclamos WN: gestión de reclamos SOLO para clientes con póliza Washington National (los planes ACA no llevan reclamos aquí). CREAR: botón "+ Nuevo reclamo" → elegir el cliente WN, tipo (Hospitalización, Accidente, Cáncer, Enfermedad crítica, Incapacidad, Otro), fecha de servicio, monto y número de reclamo. Estados: Reportado → En revisión → Aprobado/Pagado o Rechazado.

• Referidos: pestaña "Top Referidores" (ranking de clientes que refieren, botones 💬 Agradecer por WhatsApp y 📧 Email, "Ver prospectos") y pestaña "Solicitar" (enviar mensajes pidiendo referidos).

• Calendario: vista mensual de citas y eventos.
  CREAR UN EVENTO: botón "+ Nuevo evento" → título, fecha, notas y (opcional) seleccionar un cliente; si eliges un cliente, el evento también queda como una NOTA en la sección Actividades de ese cliente.
  Los cumpleaños que aparecen en el calendario son solo de los CLIENTES TITULARES de la póliza (no de los dependientes).
  GOOGLE CALENDAR: el botón "🔄 Sincronizar Google" está junto a "+ Nuevo evento". La sincronización es de DOS VÍAS: lo que creas en el CRM aparece en tu Google Calendar al instante, y lo que creas en Google llega al CRM cada pocos minutos (o al presionar ese botón). Para conectarlo por primera vez: Configuración → Integraciones y Respaldo → "Conectar Google Calendar".

  ENTRADA DE LEADS DESDE LA WEB: Configuración → Integraciones y Respaldo → "🔌 Entrada de leads desde tu web". Sirve para que el formulario de la página web de la agencia cree prospectos en el CRM automáticamente, sin copiarlos a mano. Pasos: 1) "Generar mi clave de conexión" (solo la primera vez). 2) Escribir en "Dominios autorizados" el dominio de la web, por ejemplo miagencia.com — se puede poner varios separados por comas y no hace falta el www. 3) "Guardar". 4) Pulsar "Activar" (no deja activar sin al menos un dominio). 5) Copiar el bloque "Configuración para tu web" y pegarlo en el archivo js/crm-config.js de la página. Los leads entran al Pipeline en la etapa "Nuevo Lead (Por Contactar)" con origen "Web". Si el visitante marcó la casilla de autorización para ser contactado, queda registrada la fecha y hora en el campo de consentimiento del prospecto. ACLARACIÓN IMPORTANTE si el agente pregunta: la clave NO es una contraseña — va visible en el código de la web y cualquiera puede leerla; solo sirve para que los leads lleguen a la cuenta correcta. Lo que protege de verdad es la lista de dominios autorizados. Si llegan leads falsos, se puede "Rotar la clave" (en el desplegable del mismo panel) y actualizar la web, o desactivar la entrada con el botón rojo.

  AVISO DE LEAD NUEVO POR CORREO: cuando entra un prospecto desde la web, el CRM manda un correo al instante al email configurado en Configuración → Mensajería → Notificaciones por Email → "Email del agente". Está pensado para leerlo en el móvil: el asunto lleva el nombre y el teléfono (muchas veces es lo único que se ve en la notificación) y el cuerpo trae botones grandes de "📞 Llamar" y "💬 WhatsApp" para responder de un toque, más las respuestas del quiz (hogar, ingreso) y un aviso claro de si la persona marcó o no la casilla de autorización para ser contactada. Se enciende y se apaga con el interruptor "Avisarme de cada lead nuevo", en esa misma pantalla; viene activado. REQUISITO: necesita el SMTP configurado ahí mismo (Gmail: usuario y contraseña de aplicación); si no lo está, el lead se guarda igual en el Pipeline pero no sale el correo. IMPORTANTE si el agente dice que no le llegan los avisos: 1) que revise que el interruptor esté encendido, 2) que "Email del agente" tenga su correo, 3) que el SMTP esté completo — se puede probar con el botón de enviar correo de prueba de esa sección. El aviso nunca bloquea la entrada del lead: si el correo falla, el prospecto ya quedó guardado igual.

• Comisiones: pestañas 📊 Resumen (tabla por aseguradora: vidas, PMPM, mensual/anual + sección Washington National con pagos 75%/25% y riesgo de devolución), 👤 Por Cliente, 🔍 Conciliación e 📥 Importar estado de cuenta (subir el PDF de la aseguradora). Las tasas PMPM y el día del ciclo de pago de cada aseguradora se editan al final del Resumen en "Configuración de Tasas PMPM". IMPORTANTE: la primera comisión de un cliente nuevo se cuenta a los 2 meses de la ACTIVACIÓN de la póliza (1ro del mes siguiente a la contratación), no de la fecha de contratación.

• Reportes: métricas del negocio y exportaciones.

• Tarjeta Plan: NO está en el menú lateral. Se entra desde la ficha del cliente: Clientes → abrir el cliente → botón "🪪 Generar Tarjeta" (arriba, junto a "🧮 APTC"). Se hace así porque la tarjeta siempre se genera para un cliente concreto. Genera una tarjeta-resumen del plan a partir del brochure PDF usando IA. Pasos: subir el PDF → verificar los datos (incluye "Vigencia — Desde/Hasta", que sale en formato MM/DD/YY) → generar. En el último paso puedes "📱 Enviar por WhatsApp" directo al cliente (en el teléfono adjunta la imagen sola; en computadora la descarga y abre WhatsApp), "Descargar PNG", "Imprimir", cambiar idioma ES/EN y, si vienes desde la ficha de un cliente, "Guardar tarjeta + datos en el perfil". La tarjeta muestra el LOGO de la agencia (o su nombre si no hay logo) y su web/colores — todo se configura en Configuración → Marca → Tarjeta de Plan.

• Calc. APTC: calcula el crédito fiscal según ingreso anual, tamaño de familia y edades (los valores FPL se actualizan cada enero en Configuración → Cálculos y AI).
  GEORGIA: cotiza AUTOMÁTICO igual que los estados federales. Georgia usa su propio mercado (Georgia Access) y no está en la API de CMS, pero el CRM tiene cargados sus planes y tarifas oficiales, así que basta escribir el ZIP y el estado "GA": da el SLCSP exacto, el subsidio y los mejores planes con deducible, máximo de bolsillo y copagos. No hay que copiar precios a mano. (Las tarifas se actualizan una vez al año, cuando el estado publica las del nuevo AEP; lo hace el proveedor del CRM con un script.)
  CONDADO (importante): un mismo código postal puede abarcar varios condados, y el precio cambia según cuál sea, porque cada condado pertenece a un área de tarifa distinta y no todos los planes se venden en todos los condados. Por eso, al escribir el ZIP, si abarca más de un condado la calculadora muestra un selector amarillo "Condado del cliente" y hay que preguntarle al cliente en cuál vive (es lo mismo que pide cuidadodesalud.gov y Georgia Access). Si el ZIP tiene un solo condado, se elige solo. Si el resultado no cuadra con el del mercado oficial, lo primero que hay que revisar es el condado.
  OTROS ESTADOS CON MERCADO PROPIO (California, Nueva York, Pennsylvania…): tampoco están en la API federal y todavía no tienen carga automática. Al escribir el estado, la calculadora muestra un panel con el enlace a su mercado y un campo para escribir el precio del "plan Silver de referencia" (el 2º Silver más barato, sin subsidio). Con ese precio el cálculo es EXACTO; vacío, da un estimado por edad. El cálculo del subsidio es federal e idéntico en todos los estados.
  SUBSIDIOS MEJORADOS EXPIRADOS: los subsidios ampliados (ARPA/IRA, 2021–2025) terminaron el 01/01/2026. Desde 2026 el cliente aporta MÁS de su bolsillo (tabla del IRS: 2.1% bajo 133% del FPL hasta 9.96% entre 300–400%) y volvió el "precipicio del 400%": por encima del 400% del FPL NO hay crédito fiscal. Si un cliente pregunta por qué su subsidio bajó respecto al año pasado, esta es la razón.
  BRECHA DE COBERTURA: en estados que NO expandieron Medicaid (Georgia, Florida, Texas…), quien está por debajo del 100% del FPL normalmente no califica ni para Medicaid ni para el subsidio — la calculadora lo avisa en rojo como "Brecha de cobertura" (no dice "califica para Medicaid", que sería incorrecto ahí).

• Documentos: elegir cliente + plantilla → genera la carta personalizada → enviar por Email (con el logo de la agencia) o WhatsApp.

• Agenda (📇 Agenda Telefónica): directorio de contactos del agente que NO son clientes del CRM (médicos, proveedores, aseguradoras, referidos, personal). Botón "+ Nuevo Contacto"; cada contacto tiene botones de 📞 Llamar y 💬 WhatsApp, y buscador por nombre/teléfono/empresa.
  DOCUMENTOS DEL CONTACTO: cada contacto tiene un botón "📎 Documentos" (muestra entre paréntesis cuántos tiene). Ahí se sube un archivo (PDF, imagen o Word/Excel, hasta 10 MB), se elige el tipo (ETF, Formulario, Carta, Email, Factura Médica, Póliza, Otro) y luego se puede "⬇️ Descargar" o "✉️ Enviar por email" — esto último manda el archivo COMO ADJUNTO al email del contacto, así que el contacto debe tener email guardado y el SMTP configurado (Configuración → Notificaciones por Email). Es la forma de mandarle el formulario ETF a Washington National: guardas el ETF lleno en el contacto de WN y lo envías desde ahí.

• Auditoría (solo admin): registro de quién creó/modificó/eliminó qué.

• Configuración (solo admin): organizada en pestañas. Al explicar cómo cambiar algo, di primero qué pestaña abrir:
  - 🎨 Marca: Logo de la Agencia (arrastrar PNG), Colores del Sistema y Tarjeta de Plan (página web del pie y colores de encabezado/acento de la tarjeta).
  - 👤 Perfil y Metas: Perfil del Agente (nombre, teléfonos, WhatsApp, NPN, dirección, licencias por estado, teléfonos de Georgia Access y Mercado de Salud, link de consentimientos HealthSherpa) y Objetivos de Producción.
  - 💬 Mensajería: Mensaje de Cumpleaños, Google Review (link y mensajes) y Notificaciones por Email (Gmail con contraseña de aplicación: myaccount.google.com → Seguridad → Contraseñas de aplicaciones).
  - 🧮 Cálculos y AI: define cómo se ordenan los "mejores planes" de la Calculadora APTC (mejor protección financiera vs. menor costo), los valores por defecto de las pólizas nuevas (año, renovación, vencimiento) y el % de comisión de Washington National. Nota: la conexión con datos exactos del Marketplace (CMS), los valores FPL del gobierno y la clave de IA son parte del CRM y los administra el proveedor del sistema; no se configuran por agencia.
  - 🔗 Integraciones y Respaldo: Conectar/Desconectar Google Calendar; Respaldo automático a Google Drive (una copia diaria de todos los datos, botón "💾 Respaldar ahora", conserva las últimas 30 — la primera vez hay que reconectar Google para dar el permiso de Drive); y "💾 Descargar Backup" para bajar una copia manual a la computadora.
    CARPETA DE DRIVE: en esa misma sección hay un campo "Carpeta en Google Drive" (por defecto "CRM Seguros - Backups") para elegir cómo se llama. Al cambiarlo se RENOMBRA la carpeta que ya existe, así los respaldos anteriores no se quedan sueltos en otra. El agente puede MOVER esa carpeta a donde quiera dentro de su Drive y el CRM la seguirá encontrando. No se puede elegir una carpeta que el agente haya creado a mano: el CRM pide el permiso "drive.file", que solo le deja ver los archivos que él mismo crea — nunca el resto del Drive. Es a propósito, por privacidad.
    SI EL RESPALDO FALLA: el CRM avisa en rojo en el Panel y en Configuración. El error más común es "invalid_grant" = el permiso de Google caducó; se arregla en Configuración → Integraciones y Respaldo → Desconectar → volver a Conectar. Para que no vuelva a caducar, en Google Cloud Console → Google Auth Platform → Público, el "Estado de publicación" debe estar "En producción" y no "Prueba" (en Prueba Google mata el permiso cada 7 días).
  - 🔐 Cuenta y Usuarios: Verificación en dos pasos (2FA, OBLIGATORIA: al entrar al CRM se pide un código de 6 dígitos de Google Authenticator o similar; desde aquí se puede reconfigurar el autenticador si cambiaste de teléfono y ver cuántos códigos de respaldo quedan), Cambiar Contraseña y Usuarios del Sistema (cada usuario tiene un botón "🔐 Reiniciar 2FA" por si perdió el teléfono: al reiniciarlo, esa persona vuelve a escanear el QR en su próximo inicio de sesión) (máximo 3; roles: Administrador = acceso completo, Agente = estándar sin Configuración, Asistente = limitado sin comisiones).
`.trim()

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// ── Herramientas expuestas al modelo ─────────────────────────────────────────

const TOOLS = [
  {
    name: 'buscar_clientes',
    description: 'Busca clientes por nombre y/o apellido (coincide por palabras: "Daniela Rivas" encuentra a "Daniela Paola Rivas"), por estatus (Activo, Cancelado, etc.), aseguradora o estado de EE.UU. Devuelve datos básicos —incluido el estatus— de hasta 15 clientes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        texto: { type: 'string', description: 'Nombre y/o apellido a buscar (las palabras pueden estar en cualquier posición del nombre completo)' },
        estado: { type: 'string', description: 'Filtrar por estatus: Activo, Cancelado, Con otro agente, Pendiente' },
        aseguradora: { type: 'string', description: 'Filtrar por aseguradora (ej. Ambetter, Oscar, Molina)' },
        estado_usa: { type: 'string', description: 'Filtrar por estado de EE.UU. (ej. FL, GA, TX)' },
      },
    },
  },
  {
    name: 'detalle_cliente',
    description: 'Devuelve el perfil COMPLETO de UN cliente buscado por nombre y/o apellido (coincidencia por palabras, cualquier estatus): datos personales, dirección, ingreso, póliza ACA con beneficios del plan, crédito fiscal, dental, Washington National, dependientes, citas próximas, últimas actividades, doctores, medicamentos, etiquetas y notas. NUNCA incluye SSN ni información bancaria. Si hay varias coincidencias devuelve la lista de candidatos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre: { type: 'string', description: 'Nombre y/o apellido del cliente (ej. "Daniela Rivas")' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'renovaciones',
    description: 'Lista los clientes cuya póliza se renueva dentro de los próximos N días (por defecto 60).',
    input_schema: {
      type: 'object' as const,
      properties: {
        dias: { type: 'number', description: 'Ventana en días hacia adelante (por defecto 60)' },
      },
    },
  },
  {
    name: 'agenda_hoy',
    description: 'Devuelve la agenda operativa: citas de hoy, cumpleaños de la semana y clientes con primera prima sin pagar.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'resumen_comisiones',
    description: 'Resumen de comisiones ACA estimadas del mes: vidas y comisión mensual por aseguradora (vidas × tasa PMPM). Para el detalle exacto (pagos WN, conciliación) indicar al usuario la página de Comisiones.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'conteo_por_aseguradora',
    description: 'Cuenta, para una aseguradora dada (o todas si se omite), cuántas PÓLIZAS (clientes/titulares) y cuántas VIDAS (personas aseguradas: titular + dependientes) hay. Solo cuenta pólizas activas y la aseguradora coincide sin importar mayúsculas. ÚSALA para preguntas como "cuántos clientes/pólizas tengo con Oscar" y "cuántas vidas tengo con Oscar". IMPORTANTE: una póliza puede cubrir varias vidas, no son lo mismo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre: { type: 'string', description: 'Nombre de la aseguradora (ej. Oscar, Ambetter). Si se omite, devuelve el desglose de todas.' },
      },
    },
  },
  {
    name: 'estadisticas',
    description: 'Números generales del CRM: total de clientes por estatus, altas del mes, cancelaciones del mes y distribución por aseguradora.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'oportunidades',
    description: 'Venta cruzada: clientes ACTIVOS a los que les falta un producto complementario. Devuelve cuántos y quiénes no tienen seguro Dental y cuántos y quiénes no tienen póliza Washington National (WN). Úsala para preguntas como "a quién le puedo vender dental" o "cuántos clientes no tienen WN".',
    input_schema: {
      type: 'object' as const,
      properties: {
        tipo: { type: 'string', description: 'Filtrar: "dental" (sin dental) o "wn" (sin Washington National). Si se omite, devuelve ambas listas.' },
      },
    },
  },
  {
    name: 'reclamos',
    description: 'Lista los reclamos de clientes con póliza Washington National (WN). Se puede filtrar por estatus (Reportado, En revisión, Aprobado, Pagado, Rechazado) o por nombre del cliente. Devuelve tipo, estatus, fechas y montos de cada reclamo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        estado: { type: 'string', description: 'Filtrar por estatus del reclamo (ej. Reportado, En revisión, Pagado, Rechazado)' },
        cliente: { type: 'string', description: 'Filtrar por nombre/apellido del cliente' },
      },
    },
  },
]

// ── Implementación de las herramientas (solo lectura, agencyId SIEMPRE) ──────

const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : null

// Búsqueda por palabras: "Daniela Rivas" debe encontrar a "Daniela Paola
// Rivas". Cada palabra del texto debe aparecer en el nombre (en cualquier
// posición y sin importar mayúsculas) — un `contains` del texto completo NO
// funciona cuando el cliente tiene segundo nombre o apellido.
function nameWordsWhere(texto: string) {
  const words = texto.trim().split(/\s+/).filter(Boolean)
  return { AND: words.map(w => ({ fullName: { contains: w, mode: 'insensitive' as const } })) }
}

// Vidas CUBIERTAS de una póliza = personas realmente aseguradas. Si el titular
// gestionó la póliza pero él NO está cubierto en ella (applicantInPolicy=false),
// no se cuenta. Misma regla que la página de Comisiones — una póliza puede
// cubrir varias vidas (titular + dependientes).
function coveredLives(c: { affiliatesCount: number | null; applicantInPolicy: boolean | null }): number {
  const raw = c.affiliatesCount ?? 1
  return c.applicantInPolicy === false ? Math.max(raw - 1, 0) : raw
}

async function toolBuscarClientes(agencyId: string, input: Record<string, unknown>) {
  const clients = await prisma.client.findMany({
    where: {
      agencyId,
      ...(input.texto ? nameWordsWhere(String(input.texto)) : {}),
      ...(input.estado ? { status: { equals: String(input.estado), mode: 'insensitive' as const } } : {}),
      ...(input.aseguradora ? { insurer: { contains: String(input.aseguradora), mode: 'insensitive' as const } } : {}),
      ...(input.estado_usa ? { state: { equals: String(input.estado_usa), mode: 'insensitive' as const } } : {}),
    },
    select: {
      fullName: true, status: true, insurer: true, state: true, phone: true,
      coverageType: true, totalMonthly: true, renewalDate: true, affiliatesCount: true,
    },
    orderBy: { fullName: 'asc' },
    take: 15,
  })
  return clients.map(c => ({ ...c, renewalDate: fmtDate(c.renewalDate) }))
}

async function toolDetalleCliente(agencyId: string, input: Record<string, unknown>) {
  // Búsqueda por palabras y en cualquier estatus (activo, cancelado, etc.)
  const matches = await prisma.client.findMany({
    where: { agencyId, ...nameWordsWhere(String(input.nombre || '')) },
    select: {
      // Perfil COMPLETO excepto: ssn, bank* y portalPassword (nunca viajan al modelo)
      id: true, fullName: true, status: true, phone: true, email: true,
      address: true, aptSuite: true, city: true, zipCode: true, county: true, state: true,
      birthDate: true, maritalStatus: true, migrationStatus: true, employmentType: true, filesTaxes: true,
      filingStatus: true, annualIncome: true, preferredLanguage: true,
      insurer: true, planName: true, planCategory: true, planId: true, planNetwork: true,
      planDeductible: true, planMaxOOP: true, planPCP: true, planSpecialist: true,
      planUrgentCare: true, planHospital: true, planRxGeneric: true, coverageType: true,
      policyYear: true, acaPrice: true, aptcAmount: true, totalMonthly: true,
      affiliatesCount: true, applicantInPolicy: true, applicantExclusionReason: true,
      contractDate: true, activationDate: true, renewalDate: true, cancellationDate: true,
      policyExpirationDate: true, firstPaymentPaid: true, firstPaymentDate: true,
      dentalInsurer: true, dentalDeductible: true, dentalMaxBenefit: true, dentalMonthly: true,
      wnPolicies: true, wnContractDate: true, googleReview: true, tags: true,
      preferredDoctors: true, specificMedications: true, portalUser: true,
      sherpaUrl: true, notes: true,
      dependents: { select: { type: true, name: true, birthDate: true, inPolicy: true, coverageNote: true } },
      appointments: {
        where: { date: { gte: new Date() } },
        select: { date: true, notes: true, status: true },
        orderBy: { date: 'asc' }, take: 3,
      },
    },
    orderBy: { fullName: 'asc' },
    take: 5,
  })

  if (matches.length === 0) {
    return { error: `No encontré ningún cliente cuyo nombre contenga las palabras "${input.nombre}". Prueba con menos palabras (solo nombre o solo apellido).` }
  }

  // Varias coincidencias → devolver candidatos para que el usuario elija
  if (matches.length > 1) {
    return {
      variasCoincidencias: true,
      mensaje: 'Hay varios clientes que coinciden — pregunta al usuario a cuál se refiere.',
      candidatos: matches.map(m => ({ nombre: m.fullName, estatus: m.status, aseguradora: m.insurer })),
    }
  }

  const client = matches[0]
  const activities = await prisma.activity.findMany({
    where: { clientId: client.id, agencyId },
    select: { type: true, content: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 5,
  })

  // Omitimos el id interno — el modelo no lo necesita
  const rest = { ...client, id: undefined }
  return {
    ...rest,
    contractDate: fmtDate(client.contractDate),
    activationDate: fmtDate(client.activationDate),
    renewalDate: fmtDate(client.renewalDate),
    cancellationDate: fmtDate(client.cancellationDate),
    policyExpirationDate: fmtDate(client.policyExpirationDate),
    firstPaymentDate: fmtDate(client.firstPaymentDate),
    wnContractDate: fmtDate(client.wnContractDate),
    birthDate: fmtDate(client.birthDate),
    dependents: client.dependents.map(d => ({ ...d, birthDate: fmtDate(d.birthDate) })),
    appointments: client.appointments.map(a => ({ ...a, date: a.date.toISOString() })),
    ultimasActividades: activities.map(a => ({ ...a, createdAt: fmtDate(a.createdAt) })),
  }
}

async function toolRenovaciones(agencyId: string, input: Record<string, unknown>) {
  const dias = Math.min(Math.max(Number(input.dias) || 60, 1), 365)
  const now = new Date()
  const until = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000)
  const clients = await prisma.client.findMany({
    where: { agencyId, status: 'Activo', renewalDate: { gte: now, lte: until } },
    select: { fullName: true, insurer: true, renewalDate: true, phone: true, totalMonthly: true },
    orderBy: { renewalDate: 'asc' },
    take: 30,
  })
  return { ventanaDias: dias, total: clients.length, clientes: clients.map(c => ({ ...c, renewalDate: fmtDate(c.renewalDate) })) }
}

async function toolAgendaHoy(agencyId: string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [citas, activos] = await Promise.all([
    prisma.appointment.findMany({
      where: { agencyId, date: { gte: todayStart, lt: todayEnd } },
      select: { date: true, notes: true, status: true, client: { select: { fullName: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.client.findMany({
      where: { agencyId, status: 'Activo' },
      select: { fullName: true, birthDate: true, phone: true, contractDate: true, firstPaymentPaid: true },
    }),
  ])

  const cumpleanos: { nombre: string; fecha: string; enDias: number }[] = []
  for (const c of activos) {
    if (!c.birthDate) continue
    const b = new Date(c.birthDate)
    const next = new Date(now.getFullYear(), b.getUTCMonth(), b.getUTCDate())
    if (next < todayStart) next.setFullYear(next.getFullYear() + 1)
    const dias = Math.ceil((next.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24))
    if (dias <= 7) cumpleanos.push({ nombre: c.fullName, fecha: fmtDate(next)!, enDias: dias })
  }

  const primaPendiente = activos
    .filter(c => c.firstPaymentPaid === false && c.contractDate)
    .map(c => ({ nombre: c.fullName, contrato: fmtDate(c.contractDate), telefono: c.phone }))

  return {
    citasDeHoy: citas.map(a => ({ hora: a.date.toISOString(), cliente: a.client?.fullName, notas: a.notes, estatus: a.status })),
    cumpleanosSemana: cumpleanos.sort((a, b) => a.enDias - b.enDias),
    primeraPrimaSinPagar: primaPendiente.slice(0, 15),
  }
}

async function toolResumenComisiones(agencyId: string) {
  const [clients, rates] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId, status: 'Activo' },
      select: { insurer: true, affiliatesCount: true, applicantInPolicy: true },
    }),
    prisma.commissionRate.findMany({ where: { agencyId }, select: { insurer: true, pmpm: true } }),
  ])
  const ratesMap: Record<string, number> = { ...DEFAULT_RATES }
  for (const r of rates) ratesMap[r.insurer] = r.pmpm

  const byInsurer: Record<string, { vidas: number; pmpm: number; mensual: number }> = {}
  for (const c of clients) {
    const insurer = c.insurer || 'Sin aseguradora'
    const pmpm = ratesMap[insurer] ?? 18
    const vidas = coveredLives(c)
    if (!byInsurer[insurer]) byInsurer[insurer] = { vidas: 0, pmpm, mensual: 0 }
    byInsurer[insurer].vidas += vidas
    byInsurer[insurer].mensual += pmpm * vidas
  }
  const totalMensual = Object.values(byInsurer).reduce((s, r) => s + r.mensual, 0)
  return {
    nota: 'Estimado ACA (vidas × PMPM) de clientes activos. El detalle exacto (pagos pendientes, WN, conciliación) está en la página de Comisiones.',
    porAseguradora: Object.entries(byInsurer)
      .map(([aseguradora, r]) => ({ aseguradora, ...r }))
      .sort((a, b) => b.mensual - a.mensual),
    totalMensualEstimado: totalMensual,
    totalAnualEstimado: totalMensual * 12,
  }
}

async function toolEstadisticas(agencyId: string) {
  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [porEstatus, porAseguradora, altasMes, bajasMes] = await Promise.all([
    prisma.client.groupBy({ by: ['status'], where: { agencyId }, _count: true }),
    prisma.client.groupBy({ by: ['insurer'], where: { agencyId, status: 'Activo' }, _count: true }),
    prisma.client.count({ where: { agencyId, contractDate: { gte: monthStart } } }),
    prisma.client.count({ where: { agencyId, status: { in: ['Cancelado', 'Con otro agente'] }, cancellationDate: { gte: monthStart } } }),
  ])
  return {
    porEstatus: porEstatus.map(g => ({ estatus: g.status, clientes: g._count })),
    activosPorAseguradora: porAseguradora.map(g => ({ aseguradora: g.insurer || 'Sin aseguradora', clientes: g._count })),
    altasEsteMes: altasMes,
    bajasEsteMes: bajasMes,
  }
}

// Cuenta pólizas (titulares) vs vidas (personas aseguradas) por aseguradora.
// Solo pólizas activas. La coincidencia de la aseguradora ignora mayúsculas.
async function toolConteoPorAseguradora(agencyId: string, input: Record<string, unknown>) {
  const nombre = String(input.nombre || '').trim()
  const clients = await prisma.client.findMany({
    where: {
      agencyId,
      status: 'Activo',
      ...(nombre ? { insurer: { contains: nombre, mode: 'insensitive' as const } } : {}),
    },
    select: { insurer: true, affiliatesCount: true, applicantInPolicy: true },
  })
  if (nombre && clients.length === 0) {
    return { error: `No encontré pólizas activas con una aseguradora parecida a "${nombre}".` }
  }
  // Agrupa por aseguradora (por si "oscar" coincide con más de una variante)
  const byInsurer: Record<string, { polizas: number; vidas: number }> = {}
  for (const c of clients) {
    const key = c.insurer || 'Sin aseguradora'
    if (!byInsurer[key]) byInsurer[key] = { polizas: 0, vidas: 0 }
    byInsurer[key].polizas += 1
    byInsurer[key].vidas += coveredLives(c)
  }
  const desglose = Object.entries(byInsurer)
    .map(([aseguradora, r]) => ({ aseguradora, ...r }))
    .sort((a, b) => b.polizas - a.polizas)
  return {
    nota: 'Solo pólizas activas. "polizas" = número de clientes/titulares; "vidas" = personas aseguradas (titular + dependientes cubiertos). Una póliza puede tener varias vidas.',
    consulta: nombre || 'todas las aseguradoras',
    totalPolizas: clients.length,
    totalVidas: desglose.reduce((s, r) => s + r.vidas, 0),
    desglose,
  }
}

// Venta cruzada: clientes activos sin dental / sin Washington National.
// Misma lógica que la página Oportunidades (/api/opportunities).
async function toolOportunidades(agencyId: string, input: Record<string, unknown>) {
  const tipo = String(input.tipo || '').toLowerCase()
  const clients = await prisma.client.findMany({
    where: { agencyId, status: 'Activo' },
    select: { fullName: true, phone: true, insurer: true, state: true, dentalInsurer: true, wnPolicies: true },
    orderBy: { fullName: 'asc' },
  })
  const hasWn = (wn: string | null) => !!wn && wn.includes('"type"')
  const hasDental = (d: string | null) => !!d && d.trim().length > 0
  const brief = (c: (typeof clients)[number]) => ({ nombre: c.fullName, telefono: c.phone, aseguradora: c.insurer, estado: c.state })

  const sinDental = clients.filter(c => !hasDental(c.dentalInsurer))
  const sinWn = clients.filter(c => !hasWn(c.wnPolicies))
  const result: Record<string, unknown> = {
    nota: 'Solo clientes activos. Ofréceles el producto que aún no tienen desde la página Oportunidades (botones de WhatsApp/Email).',
    totalActivos: clients.length,
  }
  if (tipo !== 'wn') { result.sinDental = { total: sinDental.length, clientes: sinDental.slice(0, 15).map(brief) } }
  if (tipo !== 'dental') { result.sinWashingtonNational = { total: sinWn.length, clientes: sinWn.slice(0, 15).map(brief) } }
  return result
}

// Reclamos de Washington National (solo lectura), con filtro opcional.
async function toolReclamos(agencyId: string, input: Record<string, unknown>) {
  const claims = await prisma.claim.findMany({
    where: {
      agencyId,
      ...(input.estado ? { status: { equals: String(input.estado), mode: 'insensitive' as const } } : {}),
      ...(input.cliente ? { client: { is: nameWordsWhere(String(input.cliente)) } } : {}),
    },
    select: {
      type: true, status: true, claimNumber: true, serviceDate: true, filedDate: true,
      amount: true, amountPaid: true, client: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return {
    nota: 'Reclamos de clientes con póliza Washington National. El detalle completo está en la página "Reclamos WN".',
    total: claims.length,
    reclamos: claims.map(c => ({
      cliente: c.client?.fullName, tipo: c.type, estatus: c.status, numero: c.claimNumber,
      fechaServicio: fmtDate(c.serviceDate), fechaEnvio: fmtDate(c.filedDate),
      montoReclamado: c.amount, montoPagado: c.amountPaid,
    })),
  }
}

async function runTool(name: string, input: Record<string, unknown>, agencyId: string, role: string): Promise<unknown> {
  switch (name) {
    case 'buscar_clientes':          return toolBuscarClientes(agencyId, input)
    case 'detalle_cliente':          return toolDetalleCliente(agencyId, input)
    case 'renovaciones':             return toolRenovaciones(agencyId, input)
    case 'agenda_hoy':               return toolAgendaHoy(agencyId)
    case 'conteo_por_aseguradora':   return toolConteoPorAseguradora(agencyId, input)
    case 'oportunidades':            return toolOportunidades(agencyId, input)
    case 'reclamos':
      if (role === 'assistant') return { error: 'El rol Asistente no tiene acceso a los reclamos WN.' }
      return toolReclamos(agencyId, input)
    case 'resumen_comisiones':
      if (role === 'assistant') return { error: 'El rol Asistente no tiene acceso a comisiones.' }
      return toolResumenComisiones(agencyId)
    case 'estadisticas':             return toolEstadisticas(agencyId)
    default:                         return { error: `Herramienta desconocida: ${name}` }
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

interface ContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  // La clave de IA es de PLATAFORMA (la controla el dueño del CRM; las agencias
  // cliente la heredan). Ver src/lib/platform.ts.
  const apiKey = await getPlatformSetting('anthropicApiKey')
  if (!apiKey) {
    return NextResponse.json({
      error: 'El asistente no está disponible: falta configurar la clave de IA del CRM (la administra el proveedor del sistema).',
    }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const history: ChatMessage[] = Array.isArray(body.messages) ? body.messages : []
  const trimmed = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY)
  if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Falta el mensaje del usuario.' }, { status: 400 })
  }

  const agentNameRow = await prisma.settings.findFirst({
    where: { agencyId: auth.agencyId, key: 'agentName' },
    select: { value: true },
  })

  const hoy = new Date().toLocaleDateString('es-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
  const system = [
    `Eres el asistente virtual del CRM de seguros de ${agentNameRow?.value || 'la agencia'}.`,
    `Hoy es ${hoy}. El usuario se llama ${auth.name || 'el agente'} (rol: ${auth.role}).`,
    'Respondes SIEMPRE en español, de forma breve y accionable. Usas las herramientas para consultar datos reales del CRM antes de responder; nunca inventas cifras ni clientes.',
    'DISTINCIÓN CLAVE: una PÓLIZA (o "cliente"/"titular") NO es lo mismo que una VIDA. Una sola póliza puede cubrir varias vidas (el titular + su cónyuge + sus hijos). Ejemplo: 1 póliza de una familia de 4 = 1 póliza pero 4 vidas. Cuando te pregunten "cuántos clientes/pólizas" o "cuántas vidas/afiliados" tengo con una aseguradora, usa la herramienta conteo_por_aseguradora, que devuelve ambos números por separado, y responde con el número correcto según lo que preguntaron.',
    'Los nombres de aseguradora y estatus no distinguen mayúsculas de minúsculas: "oscar", "OScar" y "Oscar" son la misma.',
    'Si una herramienta no devuelve lo que el usuario busca, dilo con claridad y sugiere dónde verlo en el CRM (Clientes, Pipeline, Comisiones, Hoy, Reportes, Configuración).',
    'Al buscar clientes por nombre, si detalle_cliente devuelve varias coincidencias, muestra la lista y pregunta a cuál se refiere. Siempre menciona el estatus del cliente (Activo, Cancelado, etc.) en los resultados.',
    'No tienes acceso al SSN ni a la información bancaria de los clientes; si te los piden explicas que por seguridad solo se ven en el perfil del cliente dentro del CRM.',
    'MODO INSTRUCTOR (muy importante): cuando el usuario pregunte CÓMO hacer una tarea en el sistema (registrar un cliente, enviar una campaña, crear un reclamo WN, conectar Google Calendar, activar el respaldo a Drive, subir el logo, importar un estado de cuenta, crear un usuario, etc.), NO respondas de forma vaga: guíalo como un instructor, paso a paso y numerado, con los nombres EXACTOS de la sección del menú, la pestaña y los botones según la GUÍA DEL CRM de abajo, en el orden correcto. Si la tarea depende de una configuración previa (ej. las campañas necesitan el email configurado, la Tarjeta Plan necesita la API Key), avísalo. Al final, ofrece ayudar con el siguiente paso.',
    'ASESOR DE SEGUROS: además de manejar el CRM, respondes dudas sobre la ley ACA (Obamacare) con el CONOCIMIENTO DE LA LEY ACA de abajo: qué cubre, quién califica, cómo funcionan los subsidios, qué papeles pide el Mercado, HMO vs PPO, periodos de inscripción. Explica en lenguaje sencillo, como para el cliente final.',
    'NÚMEROS DEL SUBSIDIO: nunca calcules ni cites de memoria un monto de subsidio, un SLCSP ni los límites del FPL en dólares. Esas cifras cambian cada año y el CRM tiene los valores oficiales. Manda SIEMPRE al agente a la Calculadora APTC (menú: Calc. APTC), y recuérdale que si entra desde la ficha del cliente se llena sola con sus datos. Puedes explicar los porcentajes y las reglas, pero el monto lo da la calculadora.',
    'Formato: usa listas con viñetas cuando enumeres clientes o cifras. Montos en dólares con $.',
    auth.role === 'assistant' ? 'IMPORTANTE: este usuario tiene rol Asistente y NO puede ver comisiones.' : '',
    '',
    CRM_GUIDE,
    'CAMBIO EDE CR 109 (identidad y autorización del agente): entra en vigor el 12/10/2026, antes del OEP 2027, y cambia cómo el agente inscribe. Si el agente pregunta por inscripciones, consentimiento, autorización, verificación de identidad, llamadas a tres, el Call Center o cómo prepararse para la Inscripción Abierta de 2027, usa el bloque EDE CR 109 de abajo. Dos cosas que NUNCA debes confundir: (1) la autorización del agente NO sustituye al consentimiento del cliente, son obligaciones distintas y el consentimiento va primero; (2) esto es del Mercado FEDERAL — Georgia tiene mercado propio, así que si el agente trabaja Georgia dile que lo confirme con Georgia Access en vez de darlo por hecho.',
    '',
    ACA_KNOWLEDGE,
    '',
    EDE_CR109,
  ].filter(Boolean).join('\n')

  const tools = auth.role === 'assistant'
    ? TOOLS.filter(t => t.name !== 'resumen_comisiones' && t.name !== 'reclamos')
    : TOOLS

  // Conversación para la API de Anthropic (los mensajes crecen con cada tool call)
  const messages: { role: string; content: unknown }[] = trimmed.map(m => ({ role: m.role, content: m.content }))

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools, messages }),
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({} as { error?: { message?: string } }))
        return NextResponse.json({
          error: 'Error de Claude API: ' + (e.error?.message || res.statusText),
        }, { status: 502 })
      }

      const data = await res.json() as { content: ContentBlock[]; stop_reason: string }

      if (data.stop_reason !== 'tool_use') {
        const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
        return NextResponse.json({ reply: text || 'No tengo una respuesta para eso.' })
      }

      // Ejecutar las herramientas solicitadas y continuar el bucle
      messages.push({ role: 'assistant', content: data.content })
      const toolResults = await Promise.all(
        data.content
          .filter(b => b.type === 'tool_use')
          .map(async b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: JSON.stringify(await runTool(b.name!, b.input || {}, auth.agencyId, auth.role)),
          }))
      )
      messages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({
      reply: 'La consulta requirió demasiados pasos. Intenta preguntarlo de forma más específica.',
    })
  } catch (err) {
    console.error('Assistant error:', err)
    return NextResponse.json({ error: 'Error al procesar la consulta. Intenta de nuevo.' }, { status: 500 })
  }
}
