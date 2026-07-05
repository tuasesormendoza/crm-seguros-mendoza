import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// Venta cruzada — GET /api/opportunities
//
// Detecta clientes ACTIVOS a los que se les puede ofrecer un producto
// complementario que aún NO tienen:
//   • Dental       → no tienen aseguradora dental registrada
//   • Suplementario → no tienen póliza Washington National (hospital/accidente)
//
// Basado en los datos que ya existen en el perfil. Se puede ampliar a Visión y
// Vida agregando esos campos al modelo Client en el futuro.
// ─────────────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  insurer: string | null
  state: string | null
}

export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const clients = await prisma.client.findMany({
    where: { agencyId: auth.agencyId, status: 'Activo' },
    select: {
      id: true, fullName: true, phone: true, email: true, insurer: true, state: true,
      dentalInsurer: true, wnPolicies: true,
    },
    orderBy: { fullName: 'asc' },
  })

  const basic = (c: (typeof clients)[number]): Lead => ({
    id: c.id, fullName: c.fullName, phone: c.phone, email: c.email, insurer: c.insurer, state: c.state,
  })

  // "Tiene WN" = su JSON de pólizas contiene al menos una con "type".
  const hasWn = (wn: string | null) => !!wn && wn.includes('"type"')
  const hasDental = (d: string | null) => !!d && d.trim().length > 0

  const noDental = clients.filter(c => !hasDental(c.dentalInsurer)).map(basic)
  const noWn = clients.filter(c => !hasWn(c.wnPolicies)).map(basic)

  return NextResponse.json({
    totalActive: clients.length,
    noDental,
    noWn,
  })
}
