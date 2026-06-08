import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/users/[userId]'>) {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { userId } = await ctx.params
  const { name, email, password, role, active } = await request.json()

  // Don't allow deleting the last admin
  if (active === false || role === 'agent') {
    const admins = await prisma.user.count({ where: { role: 'admin', active: true, id: { not: userId } } })
    if (admins === 0) {
      return NextResponse.json({ error: 'Debe haber al menos un administrador activo' }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined)   updateData.name = name
  if (email !== undefined)  updateData.email = email.trim().toLowerCase()
  if (role !== undefined)   updateData.role = role
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
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { userId } = await ctx.params

  // Prevent deleting last admin
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin', active: true } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'No puedes eliminar el único administrador' }, { status: 400 })
    }
  }

  await prisma.user.delete({ where: { id: userId } })
  return NextResponse.json({ success: true })
}
