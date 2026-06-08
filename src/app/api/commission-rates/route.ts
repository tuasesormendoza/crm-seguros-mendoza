import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_RATES: Record<string, number> = {
  'Oscar': 18,
  'Ambetter': 18,
  'Cigna': 20,
  'Kaiser': 18,
  'Blue Cross Blue Shield': 25,
  'UnitedHealthcare': 18,
  'Molina': 18,
  'CareSource': 19,
  'Anthem': 20,
  'Alliant': 18,
  'AmeriHealth': 20,
  'Health Spring': 18,
  'Florida Blue': 18,
}

export async function GET() {
  const stored = await prisma.commissionRate.findMany()
  const storedMap: Record<string, { pmpm: number; paymentDay: number | null }> = {}
  for (const r of stored) storedMap[r.insurer] = { pmpm: r.pmpm, paymentDay: r.paymentDay ?? null }

  const rates = Object.entries(DEFAULT_RATES).map(([insurer, defaultPmpm]) => ({
    insurer,
    pmpm: storedMap[insurer]?.pmpm ?? defaultPmpm,
    paymentDay: storedMap[insurer]?.paymentDay ?? null,
  }))

  return NextResponse.json(rates)
}

export async function PUT(request: NextRequest) {
  const data: { insurer: string; pmpm: number; paymentDay?: number | null }[] = await request.json()
  for (const { insurer, pmpm, paymentDay } of data) {
    await prisma.commissionRate.upsert({
      where: { insurer },
      update: { pmpm, paymentDay: paymentDay ?? null },
      create: { insurer, pmpm, paymentDay: paymentDay ?? null },
    })
  }
  return NextResponse.json({ ok: true })
}
