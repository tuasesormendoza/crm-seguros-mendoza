import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
