import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { DEFAULT_RATES } from '@/lib/commissions'

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
GUÍA DEL CRM (menú lateral izquierdo):
• Dashboard (inicio): KPIs del negocio, barras de objetivos de producción y alertas.
• Hoy: citas de hoy, cumpleaños de la semana (botón de WhatsApp para felicitar), clientes con primera prima sin pagar y seguimientos pendientes.
• Clientes: lista con buscador y filtros (estatus, aseguradora, estado, etiqueta, WN). REGISTRAR UN CLIENTE: botón "+ Nuevo Cliente" (arriba a la derecha) → llenar Datos Personales, Dirección, Póliza ACA (aseguradora, plan, Precio ACA, Crédito Fiscal Otorgado), Dependientes (botón "+ Agregar dependiente"), Washington National si aplica, datos bancarios y portal → "Guardar". VER/EDITAR: clic en el nombre del cliente → su perfil tiene botones Editar, Agendar Cita, y secciones de Actividades, Documentos, Historial de Pólizas, Historial de Aseguradoras, Encuestas y Google Review.
• Pipeline: tablero de prospectos por etapas (Nuevo → Contactado → Cotizado → Cerrado-Ganado/Perdido); se arrastran las tarjetas entre columnas. Incluye "Modo Combate" para cotización rápida con el link de consentimientos de HealthSherpa (ese link se configura en Configuración → Perfil del Agente).
• Referidos: pestaña "Top Referidores" (ranking de clientes que refieren, botones 💬 Agradecer por WhatsApp y 📧 Email, "Ver prospectos") y pestaña "Solicitar" (enviar mensajes pidiendo referidos).
• Calendario: vista mensual de citas y eventos.
• Comisiones: pestañas 📊 Resumen (tabla por aseguradora: vidas, PMPM, mensual/anual + sección Washington National con pagos 75%/25% y riesgo de devolución), 👤 Por Cliente, 🔍 Conciliación e 📥 Importar estado de cuenta (subir el PDF de la aseguradora). Las tasas PMPM se editan al final del Resumen en "Configuración de Tasas PMPM".
• Reportes: métricas del negocio y exportaciones.
• Tarjeta Plan: genera una tarjeta-resumen del plan a partir del brochure PDF usando IA (requiere la API Key en Configuración → Claude AI).
• Calc. APTC: calcula el crédito fiscal según ingreso anual y tamaño de familia (los valores FPL se actualizan cada enero en Configuración).
• Documentos: elegir cliente + plantilla → genera la carta personalizada → enviar por Email (con el logo de la agencia) o WhatsApp.
• Auditoría (solo admin): registro de quién creó/modificó/eliminó qué.
• Configuración (solo admin): Logo de la Agencia (arrastrar PNG), Colores del Sistema, Perfil del Agente (teléfonos, WhatsApp, NPN, dirección, licencias por estado, teléfonos de Georgia Access y Mercado de Salud, link HealthSherpa), Objetivos de Producción, Mensaje de Cumpleaños, Google Review (link y mensajes), Notificaciones por Email (Gmail con contraseña de aplicación: myaccount.google.com → Seguridad → Contraseñas de aplicaciones), Calculadora APTC/FPL + CMS API Key, valores por defecto de pólizas, Claude AI (API Key para Tarjeta Plan y este asistente), Cambiar Contraseña, Respaldo de Datos (botón "💾 Descargar Backup") y Usuarios del Sistema (máximo 3; roles: Administrador = acceso completo, Agente = estándar sin Configuración, Asistente = limitado sin comisiones).
`.trim()

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// ── Herramientas expuestas al modelo ─────────────────────────────────────────

const TOOLS = [
  {
    name: 'buscar_clientes',
    description: 'Busca clientes por nombre y/o apellido (coincide por palabras: "Daniela Mendoza" encuentra a "Daniela Paola Mendoza"), por estatus (Activo, Cancelado, etc.), aseguradora o estado de EE.UU. Devuelve datos básicos —incluido el estatus— de hasta 15 clientes.',
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
        nombre: { type: 'string', description: 'Nombre y/o apellido del cliente (ej. "Daniela Mendoza")' },
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
]

// ── Implementación de las herramientas (solo lectura, agencyId SIEMPRE) ──────

const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : null

// Búsqueda por palabras: "Daniela Mendoza" debe encontrar a "Daniela Paola
// Mendoza". Cada palabra del texto debe aparecer en el nombre (en cualquier
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
      birthDate: true, maritalStatus: true, employmentType: true, filesTaxes: true,
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

async function runTool(name: string, input: Record<string, unknown>, agencyId: string, role: string): Promise<unknown> {
  switch (name) {
    case 'buscar_clientes':          return toolBuscarClientes(agencyId, input)
    case 'detalle_cliente':          return toolDetalleCliente(agencyId, input)
    case 'renovaciones':             return toolRenovaciones(agencyId, input)
    case 'agenda_hoy':               return toolAgendaHoy(agencyId)
    case 'conteo_por_aseguradora':   return toolConteoPorAseguradora(agencyId, input)
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

  const apiKeyRow = await prisma.settings.findFirst({
    where: { agencyId: auth.agencyId, key: 'anthropicApiKey' },
    select: { value: true },
  })
  const apiKey = apiKeyRow?.value
  if (!apiKey) {
    return NextResponse.json({
      error: 'El asistente necesita una API Key de Anthropic. Configúrala en Configuración → Claude AI.',
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
    'MODO INSTRUCTOR: si el usuario pregunta CÓMO hacer algo en el sistema (registrar un cliente, subir el logo, importar un estado de cuenta, crear un usuario, etc.), guíalo paso a paso con los nombres EXACTOS de secciones y botones según la GUÍA DEL CRM de abajo. Sé específico: qué sección del menú abrir, qué botón presionar y en qué orden.',
    'Formato: usa listas con viñetas cuando enumeres clientes o cifras. Montos en dólares con $.',
    auth.role === 'assistant' ? 'IMPORTANTE: este usuario tiene rol Asistente y NO puede ver comisiones.' : '',
    '',
    CRM_GUIDE,
  ].filter(Boolean).join('\n')

  const tools = auth.role === 'assistant' ? TOOLS.filter(t => t.name !== 'resumen_comisiones') : TOOLS

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
