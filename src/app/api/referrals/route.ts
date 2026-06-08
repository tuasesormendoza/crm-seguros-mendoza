import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const prospects = await prisma.prospect.findMany({
    where: { referredByClientId: { not: null } },
    orderBy: { createdAt: 'desc' }
  })

  if (prospects.length === 0) return NextResponse.json({ referrers: [] })

  const clientIds = [...new Set(prospects.map(p => p.referredByClientId!))]
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, fullName: true, phone: true, email: true }
  })
  const clientMap = new Map(clients.map(c => [c.id, c]))

  const grouped = new Map<string, typeof prospects>()
  for (const p of prospects) {
    const cid = p.referredByClientId!
    if (!grouped.has(cid)) grouped.set(cid, [])
    grouped.get(cid)!.push(p)
  }

  const referrers = []
  for (const [clientId, ps] of grouped.entries()) {
    const client = clientMap.get(clientId)
    const converted = ps.filter(p => p.stage === 'Cerrado - Ganado').length
    const lost = ps.filter(p => p.stage === 'Cerrado - Perdido').length
    const pending = ps.length - converted - lost
    const lastReferralDate = ps[0].createdAt.toISOString()
    referrers.push({
      clientId,
      clientName: client?.fullName || ps[0].referredByName || 'Desconocido',
      clientPhone: client?.phone || null,
      clientEmail: client?.email || null,
      totalReferrals: ps.length,
      converted,
      pending,
      lost,
      conversionRate: ps.length > 0 ? Math.round((converted / ps.length) * 100) : 0,
      lastReferralDate,
      prospects: ps,
    })
  }

  referrers.sort((a, b) => b.totalReferrals - a.totalReferrals)

  return NextResponse.json({ referrers })
}
