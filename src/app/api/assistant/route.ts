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

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// ── Herramientas expuestas al modelo ─────────────────────────────────────────

const TOOLS = [
  {
    name: 'buscar_clientes',
    description: 'Busca clientes por nombre, estado (Activo, Cancelado, etc.), aseguradora o estado de EE.UU. Devuelve datos básicos de hasta 15 clientes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        texto: { type: 'string', description: 'Texto a buscar en el nombre del cliente' },
        estado: { type: 'string', description: 'Filtrar por estatus: Activo, Cancelado, Con otro agente, Pendiente' },
        aseguradora: { type: 'string', description: 'Filtrar por aseguradora (ej. Ambetter, Oscar, Molina)' },
        estado_usa: { type: 'string', description: 'Filtrar por estado de EE.UU. (ej. FL, GA, TX)' },
      },
    },
  },
  {
    name: 'detalle_cliente',
    description: 'Devuelve el perfil de UN cliente buscado por nombre: póliza, plan, fechas, dependientes, citas próximas y últimas actividades. No incluye datos sensibles.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre: { type: 'string', description: 'Nombre (o parte del nombre) del cliente' },
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
    name: 'estadisticas',
    description: 'Números generales del CRM: total de clientes por estatus, altas del mes, cancelaciones del mes y distribución por aseguradora.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

// ── Implementación de las herramientas (solo lectura, agencyId SIEMPRE) ──────

const fmtDate = (d: Date | null) => d ? d.toISOString().split('T')[0] : null

async function toolBuscarClientes(agencyId: string, input: Record<string, unknown>) {
  const clients = await prisma.client.findMany({
    where: {
      agencyId,
      ...(input.texto ? { fullName: { contains: String(input.texto), mode: 'insensitive' as const } } : {}),
      ...(input.estado ? { status: String(input.estado) } : {}),
      ...(input.aseguradora ? { insurer: { contains: String(input.aseguradora), mode: 'insensitive' as const } } : {}),
      ...(input.estado_usa ? { state: String(input.estado_usa) } : {}),
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
  const client = await prisma.client.findFirst({
    where: { agencyId, fullName: { contains: String(input.nombre || ''), mode: 'insensitive' } },
    select: {
      id: true, fullName: true, status: true, phone: true, email: true, state: true, city: true,
      insurer: true, planName: true, planCategory: true, coverageType: true,
      acaPrice: true, aptcAmount: true, totalMonthly: true, affiliatesCount: true,
      contractDate: true, activationDate: true, renewalDate: true, cancellationDate: true,
      firstPaymentPaid: true, birthDate: true, preferredLanguage: true, googleReview: true,
      wnPolicies: true, notes: true,
      dependents: { select: { type: true, name: true, inPolicy: true } },
      appointments: {
        where: { date: { gte: new Date() } },
        select: { date: true, notes: true, status: true },
        orderBy: { date: 'asc' }, take: 3,
      },
    },
  })
  if (!client) return { error: `No encontré ningún cliente con nombre parecido a "${input.nombre}".` }

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
    birthDate: fmtDate(client.birthDate),
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
    const raw = c.affiliatesCount ?? 1
    const vidas = c.applicantInPolicy === false ? Math.max(raw - 1, 0) : raw
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

async function runTool(name: string, input: Record<string, unknown>, agencyId: string, role: string): Promise<unknown> {
  switch (name) {
    case 'buscar_clientes':    return toolBuscarClientes(agencyId, input)
    case 'detalle_cliente':    return toolDetalleCliente(agencyId, input)
    case 'renovaciones':       return toolRenovaciones(agencyId, input)
    case 'agenda_hoy':         return toolAgendaHoy(agencyId)
    case 'resumen_comisiones':
      if (role === 'assistant') return { error: 'El rol Asistente no tiene acceso a comisiones.' }
      return toolResumenComisiones(agencyId)
    case 'estadisticas':       return toolEstadisticas(agencyId)
    default:                   return { error: `Herramienta desconocida: ${name}` }
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
    'Si una herramienta no devuelve lo que el usuario busca, dilo con claridad y sugiere dónde verlo en el CRM (Clientes, Pipeline, Comisiones, Hoy, Reportes, Configuración).',
    'No tienes acceso a datos sensibles (SSN, cuentas bancarias, contraseñas) y si te los piden explicas que solo se ven en el perfil del cliente.',
    'Formato: usa listas con viñetas cuando enumeres clientes o cifras. Montos en dólares con $.',
    auth.role === 'assistant' ? 'IMPORTANTE: este usuario tiene rol Asistente y NO puede ver comisiones.' : '',
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
