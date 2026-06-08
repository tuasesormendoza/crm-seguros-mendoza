import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const prospects = await prisma.prospect.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(prospects)
}

export async function POST(request: NextRequest) {
  const { fullName, phone, email, state, source, notes, referredByClientId, referredByName } = await request.json()
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
