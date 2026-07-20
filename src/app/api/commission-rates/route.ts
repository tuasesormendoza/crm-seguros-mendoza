import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { DEFAULT_RATES, DEFAULT_PAYMENT_DAYS } from '@/lib/commissions'

export async function GET() {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const stored = await prisma.commissionRate.findMany({ where: { agencyId: auth.agencyId } })
  const storedMap: Record<string, { pmpm: number; paymentDay: number | null; monthsToFirstPayment: number | null }> = {}
  for (const r of stored) storedMap[r.insurer] = { pmpm: r.pmpm, paymentDay: r.paymentDay ?? null, monthsToFirstPayment: r.monthsToFirstPayment ?? null }

  const rates = Object.entries(DEFAULT_RATES).map(([insurer, defaultPmpm]) => ({
    insurer,
    pmpm: storedMap[insurer]?.pmpm ?? defaultPmpm,
    paymentDay: storedMap[insurer]?.paymentDay ?? DEFAULT_PAYMENT_DAYS[insurer] ?? null,
    monthsToFirstPayment: storedMap[insurer]?.monthsToFirstPayment ?? 2,
  }))

  return NextResponse.json(rates)
}

export async function PUT(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const data: { insurer: string; pmpm: number; paymentDay?: number | null; monthsToFirstPayment?: number | null }[] = await request.json()
  for (const { insurer, pmpm, paymentDay, monthsToFirstPayment } of data) {
    await prisma.commissionRate.upsert({
      where: { agencyId_insurer: { agencyId: auth.agencyId, insurer } },
      update: { pmpm, paymentDay: paymentDay ?? null, monthsToFirstPayment: monthsToFirstPayment ?? 2 },
      create: { agencyId: auth.agencyId, insurer, pmpm, paymentDay: paymentDay ?? null, monthsToFirstPayment: monthsToFirstPayment ?? 2 },
    })
  }
  return NextResponse.json({ ok: true })
}
