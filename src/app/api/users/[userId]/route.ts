import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/users/[userId]'>) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { userId } = await ctx.params

  // El usuario objetivo debe pertenecer a la MISMA agencia que el admin.
  const target = await prisma.user.findFirst({ where: { id: userId, agencyId: auth.agencyId }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { name, email, password, role, active } = await request.json()

  // No permitir degradar/desactivar al último admin de la agencia
  if (active === false || (role !== undefined && role !== 'admin')) {
    const admins = await prisma.user.count({ where: { agencyId: auth.agencyId, role: 'admin', active: true, id: { not: userId } } })
    if (admins === 0) {
      return NextResponse.json({ error: 'Debe haber al menos un administrador activo' }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined)   updateData.name = name
  if (email !== undefined)  updateData.email = email.trim().toLowerCase()
  if (role !== undefined)   updateData.role = ['admin', 'assistant'].includes(role) ? role : 'agent'
  if (active !== undefined) updateData.active = active
  if (password && password.length >= 8) updateData.password = await bcrypt.hash(password, 12)

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/users/[userId]'>) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { userId } = await ctx.params

  // El usuario objetivo debe pertenecer a la MISMA agencia que el admin.
  const user = await prisma.user.findFirst({ where: { id: userId, agencyId: auth.agencyId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Evitar eliminar el único administrador de la agencia
  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { agencyId: auth.agencyId, role: 'admin', active: true } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'No puedes eliminar el único administrador' }, { status: 400 })
    }
  }

  await prisma.user.delete({ where: { id: userId } })
  return NextResponse.json({ success: true })
}
