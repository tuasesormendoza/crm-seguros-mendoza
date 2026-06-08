import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { currentPassword, newPassword } = await request.json()

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  // Get stored password from DB (supports both plain text and bcrypt)
  const stored = await prisma.settings.findUnique({ where: { key: 'appPassword' } })
  const storedValue = stored?.value || process.env.SESSION_PASSWORD || 'admin123'

  // Verify current password
  let currentOk = false
  if (storedValue.startsWith('$2')) {
    currentOk = await bcrypt.compare(currentPassword, storedValue)
  } else {
    currentOk = currentPassword === storedValue
  }

  if (!currentOk) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 401 })
  }

  // Hash the new password with bcrypt
  const hashed = await bcrypt.hash(newPassword, 12)

  await prisma.settings.upsert({
    where: { key: 'appPassword' },
    update: { value: hashed },
    create: { key: 'appPassword', value: hashed },
  })

  return NextResponse.json({ success: true })
}
