import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'

const DEFAULT_RATES: Record<string, number> = {
  'Blue Cross Blue Shield': 25,
  'UnitedHealthcare': 18,
  'Oscar': 18,
  'Ambetter': 18,
  'Cigna': 20,
  'Aetna': 18,
  'CareSource': 19,
  'AmeriHealth': 20,
  'Molina': 18,
  'Anthem': 20,
  'Kaiser': 18,
  'Alliant': 18,
  'AvMed': 18,
  'Health Spring': 18,
  'Health First': 18,
  'Florida Blue': 18,
}

export async function GET() {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const stored = await prisma.commissionRate.findMany({ where: { agencyId: auth.agencyId } })
  const storedMap: Record<string, { pmpm: number; paymentDay: number | null; monthsToFirstPayment: number | null }> = {}
  for (const r of stored) storedMap[r.insurer] = { pmpm: r.pmpm, paymentDay: r.paymentDay ?? null, monthsToFirstPayment: r.monthsToFirstPayment ?? null }

  const rates = Object.entries(DEFAULT_RATES).map(([insurer, defaultPmpm]) => ({
    insurer,
    pmpm: storedMap[insurer]?.pmpm ?? defaultPmpm,
    paymentDay: storedMap[insurer]?.paymentDay ?? null,
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
