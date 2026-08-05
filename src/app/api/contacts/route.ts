import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

// Agenda telefónica del agente — contactos sueltos (médicos, proveedores,
// referidos, personal). Aislada por agencia como todo el CRM.

export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const where = {
    agencyId: auth.agencyId,
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { phone: { contains: q } },
        { company: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {}),
  }
  // El conteo de documentos se manda con la lista para poder mostrar "📎 2"
  // en la tarjeta sin una petición extra por contacto.
  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { documents: true } } },
  })
  return NextResponse.json(contacts.map(({ _count, ...c }) => ({ ...c, docCount: _count.documents })))
}

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const b = await request.json().catch(() => ({}))
  if (!b.name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  const contact = await prisma.contact.create({
    data: {
      agencyId: auth.agencyId,
      name: String(b.name).trim(),
      phone: b.phone ? String(b.phone).trim() : null,
      email: b.email ? String(b.email).trim() : null,
      company: b.company ? String(b.company).trim() : null,
      category: b.category ? String(b.category).trim() : null,
      notes: b.notes ? String(b.notes).trim() : null,
    },
  })
  return NextResponse.json(contact, { status: 201 })
}
