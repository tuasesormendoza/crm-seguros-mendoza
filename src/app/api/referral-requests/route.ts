import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

// Lista de clientes activos con teléfono, para la campaña de "solicitud de
// referidos" — incluye el estado actual de la solicitud para poder filtrar
// y dar seguimiento (recordatorios) desde el frontend.
export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const clients = await prisma.client.findMany({
    where: { agencyId: auth.agencyId, status: 'Activo', phone: { not: null } },
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
