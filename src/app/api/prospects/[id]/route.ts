import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateProspect, validationError } from '@/lib/validate'
import { getAuth } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const data = await request.json()
  const errors = validateProspect(data)
  if (Object.keys(errors).length > 0) return validationError(errors)
  const { agencyId: _ignore, id: _id, ...safe } = data  // nunca reasignar agencia/id
  const res = await prisma.prospect.updateMany({ where: { id, agencyId: auth.agencyId }, data: safe })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const prospect = await prisma.prospect.findUnique({ where: { id } })
  return NextResponse.json(prospect)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const res = await prisma.prospect.deleteMany({ where: { id, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
