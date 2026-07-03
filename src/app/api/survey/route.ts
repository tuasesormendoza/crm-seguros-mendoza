import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/survey?clientId=xxx — returns client first name (public, no auth)
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 })

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { fullName: true },
  })
  if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const firstName = client.fullName.split(' ')[0]
  return NextResponse.json({ firstName })
}

// POST /api/survey — submit survey response (public, no auth)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, ratingAtention, ratingClarity, ratingSpeed, ratingDedication, recommends, comments } = body

    if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 })

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { agencyId: true },
    })
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    // Anti-spam: esta ruta es pública (el clientId del link actúa como token),
    // así que limitamos a 1 respuesta por cliente cada 24 horas.
    const recent = await prisma.surveyResponse.findFirst({
      where: { clientId, submittedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { id: true },
    })
    if (recent) {
      return NextResponse.json(
        { error: 'Ya recibimos tu respuesta. ¡Gracias por tu opinión!' },
        { status: 429 }
      )
    }

    const survey = await prisma.surveyResponse.create({
      data: {
        clientId,
        agencyId: client.agencyId,
        ratingAtention: ratingAtention ? Number(ratingAtention) : null,
        ratingClarity: ratingClarity ? Number(ratingClarity) : null,
        ratingSpeed: ratingSpeed ? Number(ratingSpeed) : null,
        ratingDedication: ratingDedication ? Number(ratingDedication) : null,
        recommends: recommends || null,
        comments: comments || null,
      },
    })

    return NextResponse.json({ ok: true, id: survey.id })
  } catch (err) {
    console.error('Survey POST error:', err)
    return NextResponse.json({ error: 'Error al guardar la encuesta' }, { status: 500 })
  }
}
