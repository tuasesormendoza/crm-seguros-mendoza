import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'

// Registro manual de pagos de comisión efectivamente recibidos (insurer + período
// "YYYY-MM" + monto + fecha). Se usa para comparar lo cobrado vs. lo proyectado.

export async function GET() {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const payments = await prisma.commissionPayment.findMany({
    where: { agencyId: auth.agencyId },
    orderBy: [{ receivedDate: 'desc' }],
  })
  return NextResponse.json(payments)
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const body = await request.json()
  const { insurer, period, amount, receivedDate, notes } = body as {
    insurer?: string
    period?: string
    amount?: number | string
    receivedDate?: string
    notes?: string
  }

  if (!insurer || !period || !receivedDate || amount === undefined || amount === null) {
    return NextResponse.json({ error: 'Faltan datos: aseguradora, período, monto y fecha son requeridos' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'Período inválido, debe tener formato YYYY-MM' }, { status: 400 })
  }

  const payment = await prisma.commissionPayment.create({
    data: {
      agencyId: auth.agencyId,
      insurer,
      period,
      amount: typeof amount === 'string' ? parseFloat(amount) : amount,
      receivedDate: new Date(receivedDate),
      notes: notes || null,
    },
  })

  return NextResponse.json(payment, { status: 201 })
}
