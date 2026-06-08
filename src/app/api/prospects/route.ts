import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateProspect, validationError } from '@/lib/validate'

export async function GET() {
  const prospects = await prisma.prospect.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(prospects)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const errors = validateProspect(body)
  if (Object.keys(errors).length > 0) return validationError(errors)
  const { fullName, phone, email, state, source, notes, referredByClientId, referredByName } = body
  const prospect = await prisma.prospect.create({
    data: {
      fullName,
      phone: phone || null,
      email: email || null,
      state: state || null,
      source: source || null,
      notes: notes || null,
      referredByClientId: referredByClientId || null,
      referredByName: referredByName || null,
    },
  })
  return NextResponse.json(prospect, { status: 201 })
}
