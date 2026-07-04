import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth, clientInAgency } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { title, date, notes, clientId } = await request.json()
  if (!title || !date) {
    return NextResponse.json({ error: 'title y date son requeridos' }, { status: 400 })
  }

  // Si el evento se asocia a un cliente, ese cliente debe pertenecer a la agencia.
  let linkedClientId: string | null = null
  if (clientId) {
    if (!(await clientInAgency(clientId, auth.agencyId))) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }
    linkedClientId = clientId
  }

  const event = await prisma.calendarEvent.create({
    data: {
      agencyId: auth.agencyId,
      title,
      date: new Date(date),
      notes: notes || null,
      clientId: linkedClientId,
    },
  })

  // Al vincular un cliente, dejamos constancia en su historial de actividad.
  if (linkedClientId) {
    const when = new Date(date).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })
    await prisma.activity.create({
      data: {
        clientId: linkedClientId,
        agencyId: auth.agencyId,
        type: 'evento',
        content: `📅 Evento agendado para el ${when}: ${title}${notes ? ` — ${notes}` : ''}`,
      },
    })
  }

  return NextResponse.json(event)
}
