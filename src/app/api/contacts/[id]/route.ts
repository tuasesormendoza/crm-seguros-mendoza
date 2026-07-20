import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const b = await request.json().catch(() => ({}))
  if (!b.name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  const res = await prisma.contact.updateMany({
    where: { id, agencyId: auth.agencyId },
    data: {
      name: String(b.name).trim(),
      phone: b.phone ? String(b.phone).trim() : null,
      email: b.email ? String(b.email).trim() : null,
      company: b.company ? String(b.company).trim() : null,
      category: b.category ? String(b.category).trim() : null,
      notes: b.notes ? String(b.notes).trim() : null,
    },
  })
  if (res.count === 0) return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const res = await prisma.contact.deleteMany({ where: { id, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
