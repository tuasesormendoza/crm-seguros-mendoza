import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateProspect, validationError } from '@/lib/validate'

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const data = await request.json()
  const errors = validateProspect(data)
  if (Object.keys(errors).length > 0) return validationError(errors)
  const prospect = await prisma.prospect.update({ where: { id }, data })
  return NextResponse.json(prospect)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  await prisma.prospect.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
