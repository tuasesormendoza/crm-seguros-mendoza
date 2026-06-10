import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Lista de clientes activos con teléfono, para la campaña de "solicitud de
// referidos" — incluye el estado actual de la solicitud para poder filtrar
// y dar seguimiento (recordatorios) desde el frontend.
export async function GET() {
  const clients = await prisma.client.findMany({
    where: { status: 'Activo', phone: { not: null } },
    select: {
      id: true,
      fullName: true,
      phone: true,
      referralRequestStage: true,
      referralRequestSentAt: true,
      referralRequestLastSent: true,
    },
    orderBy: { fullName: 'asc' },
  })

  return NextResponse.json({ clients })
}
