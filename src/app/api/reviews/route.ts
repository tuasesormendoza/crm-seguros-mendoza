import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

// GET /api/reviews — clientes con el estado de su reseña de Google.
//
// Devuelve solo lo que la pantalla necesita (nombre, teléfono, etapa y desde
// cuándo es cliente); nada de datos sensibles. Los cancelados van marcados para
// que el agente no les pida una reseña sin darse cuenta.
export async function GET() {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const clients = await prisma.client.findMany({
    where: { agencyId: auth.agencyId },
    select: {
      id: true, fullName: true, phone: true, email: true,
      googleReview: true, status: true, contractDate: true,
    },
    orderBy: { fullName: 'asc' },
  })

  const rows = clients.map(c => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    googleReview: c.googleReview,
    status: c.status,
    contractDate: c.contractDate ? c.contractDate.toISOString().slice(0, 10) : null,
  }))

  // Plantillas y enlace configurados por la agencia (Configuración → Mensajería).
  const rows2 = await prisma.settings.findMany({
    where: {
      agencyId: auth.agencyId,
      key: { in: ['googleReviewLink', 'whatsappTemplate', 'whatsappReminderTemplate', 'agentName'] },
    },
  })
  const s: Record<string, string> = {}
  rows2.forEach(r => { s[r.key] = r.value })

  return NextResponse.json({
    clients: rows,
    link: s.googleReviewLink || '',
    template: s.whatsappTemplate || '',
    reminder: s.whatsappReminderTemplate || '',
    agentName: s.agentName || '',
  })
}
