import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const clients = await prisma.client.findMany({
    select: {
      fullName: true, email: true, phone: true, insurer: true,
      planName: true, planCategory: true, status: true, renewalDate: true,
      totalMonthly: true, state: true, coverageType: true, city: true,
    },
    orderBy: { fullName: 'asc' },
  })

  const headers = [
    'Nombre', 'Email', 'Teléfono', 'Aseguradora', 'Plan', 'Categoría',
    'Estado', 'Fecha Renovación', 'Mensual Total', 'Estado/Estado', 'Tipo Cobertura', 'Ciudad'
  ]

  const rows = clients.map(c => [
    c.fullName,
    c.email || '',
    c.phone || '',
    c.insurer || '',
    c.planName || '',
    c.planCategory || '',
    c.status || '',
    c.renewalDate ? new Date(c.renewalDate).toLocaleDateString('es-US') : '',
    c.totalMonthly?.toFixed(2) || '0.00',
    c.state || '',
    c.coverageType || '',
    c.city || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [headers.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientes-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
