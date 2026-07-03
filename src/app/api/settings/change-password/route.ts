import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { validatePassword } from '@/lib/validate'

export async function POST(request: NextRequest) {
  const { currentPassword, newPassword } = await request.json()

  const pwError = validatePassword(newPassword)
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 })

  // Get the logged-in user from session
  const session = await getSession()
  if (!session.isLoggedIn || !session.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Look up user in the User table
  const user = await prisma.user.findUnique({ where: { email: session.email } })
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Verify current password against User.password
  let currentOk = false
  if (user.password.startsWith('$2')) {
    currentOk = await bcrypt.compare(currentPassword, user.password)
  } else {
    currentOk = currentPassword === user.password
  }

  if (!currentOk) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 })
  }

  // Hash new password and save to User table
  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { email: session.email },
    data: { password: hashed },
  })

  return NextResponse.json({ success: true })
}
