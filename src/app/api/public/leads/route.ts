import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  looksLikeKey,
  originAllowed,
  validateIntake,
  isHoneypotTripped,
  normalizeIntake,
  rateLimited,
  type IntakeInput,
} from '@/lib/publicIntake'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/public/leads — entrada de prospectos desde la web pública
//
// ÚNICO endpoint del CRM sin sesión iniciada. Genérico y multi-inquilino: no
// contiene nada específico de ninguna agencia. Cada una configura su clave y
// sus dominios permitidos desde su propia ficha.
//
// Solo escribe. Nunca devuelve datos de la agencia ni de sus clientes, ni
// siquiera confirma si una clave existe: ante cualquier problema responde lo
// mismo, para no servir de oráculo a quien pruebe claves al azar.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BODY = 20_000   // bytes

/** Respuesta uniforme: no revela por qué falló. */
function rechazo(origin: string | null, status = 400) {
  return withCors(NextResponse.json({ ok: false }, { status }), origin)
}

function withCors(res: NextResponse, origin: string | null) {
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Vary', 'Origin')
  }
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  res.headers.set('Access-Control-Max-Age', '86400')
  return res
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'desconocida'
  )
}

/** Preflight del navegador. */
export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get('origin'))
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')

  // 1) Freno por IP antes de tocar la base de datos
  if (rateLimited(clientIp(request))) return rechazo(origin, 429)

  // 2) Cuerpo con tope de tamaño
  const raw = await request.text()
  if (raw.length > MAX_BODY) return rechazo(origin, 413)

  let body: IntakeInput
  try {
    body = JSON.parse(raw) as IntakeInput
  } catch {
    return rechazo(origin)
  }

  // 3) Campo trampa: si un bot lo rellenó, respondemos 200 para que crea que
  //    funcionó y no reintente, pero no guardamos nada.
  if (isHoneypotTripped(body)) {
    return withCors(NextResponse.json({ ok: true }, { status: 201 }), origin)
  }

  // 4) Forma de la clave antes de consultar
  if (!looksLikeKey(body.key)) return rechazo(origin, 401)

  const agency = await prisma.agency.findUnique({
    where: { publicIntakeKey: body.key as string },
    select: { id: true, active: true, publicIntakeEnabled: true, publicIntakeOrigins: true },
  })

  if (!agency || !agency.active || !agency.publicIntakeEnabled) return rechazo(origin, 401)

  // 5) El origen debe estar entre los que la agencia autorizó
  if (!originAllowed(origin, agency.publicIntakeOrigins)) return rechazo(origin, 403)

  // 6) Validación de contenido
  const errors = validateIntake(body)
  if (Object.keys(errors).length > 0) {
    return withCors(NextResponse.json({ ok: false, errors }, { status: 422 }), origin)
  }

  // 7) Alta del prospecto
  const lead = normalizeIntake(body)
  await prisma.prospect.create({
    data: {
      agencyId: agency.id,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      state: lead.state,
      zipCode: lead.zipCode,
      householdSize: lead.householdSize,
      income: lead.income,
      source: lead.source,
      notes: lead.notes,
      consentAt: lead.consentAt,
      // stage se queda en el valor por defecto: "Nuevo Lead (Por Contactar)"
    },
  })

  return withCors(NextResponse.json({ ok: true }, { status: 201 }), origin)
}
