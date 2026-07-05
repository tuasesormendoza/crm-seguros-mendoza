import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'
import { pullAccounts } from '@/lib/calendarSync'

// Sincronización "al abrir el calendario": si el último pull de Google de esta
// agencia tiene más de 3 minutos, traemos los cambios ANTES de responder. Es el
// respaldo del cron de Netlify (que ha demostrado ser poco confiable) — así los
// eventos de Google llegan solos justo cuando el usuario está mirando.
const PULL_STALE_MS = 3 * 60 * 1000

async function pullIfStale(agencyId: string): Promise<void> {
  try {
    const last = await prisma.settings.findUnique({
      where: { agencyId_key: { agencyId, key: 'googleLastSync' } },
      select: { updatedAt: true },
    })
    if (!last || Date.now() - last.updatedAt.getTime() > PULL_STALE_MS) {
      await pullAccounts(agencyId) // incremental: rápido; si falla no rompe nada
    }
  } catch (err) {
    console.error('pullIfStale falló:', err)
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const agencyId = auth.agencyId

  // Traer cambios de Google si el último pull ya está viejo (respaldo del cron)
  await pullIfStale(agencyId)

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
  const [year, mon] = month.split('-').map(Number)

  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 0, 23, 59, 59)

  // Appointments
  const appointments = await prisma.appointment.findMany({
    where: { agencyId, date: { gte: start, lte: end } },
    include: { client: { select: { id: true, fullName: true } } },
  })

  // Manually-created calendar events (incluye el cliente vinculado si lo hay)
  const events = await prisma.calendarEvent.findMany({
    where: { agencyId, date: { gte: start, lte: end } },
    include: { client: { select: { id: true, fullName: true } } },
    orderBy: { date: 'asc' },
  })

  // Renewals
  const renewals = await prisma.client.findMany({
    where: { agencyId, renewalDate: { gte: start, lte: end } },
    select: { id: true, fullName: true, renewalDate: true, insurer: true },
  })

  // Birthdays — SOLO clientes titulares de la póliza (los dependientes no se
  // muestran en el calendario, a pedido del usuario).
  const allClients = await prisma.client.findMany({
    select: { id: true, fullName: true, birthDate: true },
    where: { agencyId, birthDate: { not: null } },
  })

  const birthdays: { id: string; name: string; date: string; clientId?: string }[] = []

  for (const c of allClients) {
    if (!c.birthDate) continue
    const bd = new Date(c.birthDate)
    if (bd.getUTCMonth() + 1 === mon) {
      birthdays.push({
        id: c.id,
        name: c.fullName,
        date: `${year}-${String(mon).padStart(2, '0')}-${String(bd.getUTCDate()).padStart(2, '0')}`,
        clientId: c.id,
      })
    }
  }

  return NextResponse.json({ appointments, renewals, birthdays, events })
}
