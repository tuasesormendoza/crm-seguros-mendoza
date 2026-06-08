import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ssn = searchParams.get('ssn') || ''
  const name = searchParams.get('name') || ''
  const excludeId = searchParams.get('excludeId') || ''

  const duplicates: { id: string; fullName: string; reason: string }[] = []

  if (ssn && ssn.replace(/\D/g, '').length === 9) {
    const bySSN = await prisma.client.findMany({
      where: { ssn, id: excludeId ? { not: excludeId } : undefined },
      select: { id: true, fullName: true }
    })
    bySSN.forEach(c => duplicates.push({ ...c, reason: 'SSN idéntico' }))
  }

  if (name && name.length >= 4) {
    const byName = await prisma.client.findMany({
      where: {
        fullName: { contains: name.split(' ')[0] },
        id: excludeId ? { not: excludeId } : undefined
      },
      select: { id: true, fullName: true }
    })
    byName
      .filter(c => !duplicates.find(d => d.id === c.id))
      .forEach(c => duplicates.push({ ...c, reason: 'Nombre similar' }))
  }

  return NextResponse.json(duplicates)
}
