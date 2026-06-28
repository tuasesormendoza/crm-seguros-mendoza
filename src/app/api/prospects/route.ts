import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateProspect, validationError } from '@/lib/validate'
import { getAuth } from '@/lib/auth'

export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const prospects = await prisma.prospect.findMany({ where: { agencyId: auth.agencyId }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(prospects)
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const body = await request.json()
  const errors = validateProspect(body)
  if (Object.keys(errors).length > 0) return validationError(errors)
  const { fullName, phone, email, state, source, notes, referredByClientId, referredByName, stage, lossReason } = body
  const VALID_STAGES = [
    'Nuevo Lead (Por Contactar)', 'Contactado – En Conversación',
    'En Espera de Decisión / Docs', 'Cerrado - Ganado', 'Cerrado - Perdido',
  ]
  const VALID_LOSS_REASONS = ['GHOSTING', 'FALTA_DOCUMENTACION', 'PRECIO_INGRESOS', 'COMPETENCIA']
  const prospect = await prisma.prospect.create({
    data: {
      agencyId: auth.agencyId,
      fullName,
      phone: phone || null,
      email: email || null,
      state: state || null,
      source: source || null,
      notes: notes || null,
      referredByClientId: referredByClientId || null,
      referredByName: referredByName || null,
      stage: VALID_STAGES.includes(stage) ? stage : undefined,
      lossReason: VALID_LOSS_REASONS.includes(lossReason) ? lossReason : null,
    },
  })
  return NextResponse.json(prospect, { status: 201 })
}
