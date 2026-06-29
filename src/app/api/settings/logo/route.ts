import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const formData = await request.formData()
  const file = formData.get('logo') as File | null

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Solo se aceptan PNG, JPG, WEBP o SVG' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 2 MB' }, { status: 400 })
  }

  // Keep original extension
  const ext = file.type === 'image/svg+xml' ? 'svg'
    : file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : 'jpg'

  const fileName = `brand-logo.${ext}`
  const publicDir = path.join(process.cwd(), 'public')
  await mkdir(publicDir, { recursive: true })

  // Remove old logos with other extensions
  const { unlink } = await import('fs/promises')
  for (const e of ['png','jpg','jpeg','webp','svg']) {
    await unlink(path.join(publicDir, `brand-logo.${e}`)).catch(() => null)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(publicDir, fileName), buffer)

  const logoUrl = `/${fileName}?v=${Date.now()}`
  // Store as base64 data URL so email clients can embed it inline
  // without depending on the server being reachable from the recipient's email client
  const logoBase64 = `data:${file.type};base64,${buffer.toString('base64')}`

  await Promise.all([
    prisma.settings.upsert({
      where: { agencyId_key: { agencyId: auth.agencyId, key: 'logoUrl' } },
      update: { value: logoUrl },
      create: { agencyId: auth.agencyId, key: 'logoUrl', value: logoUrl },
    }),
    prisma.settings.upsert({
      where: { agencyId_key: { agencyId: auth.agencyId, key: 'logoBase64' } },
      update: { value: logoBase64 },
      create: { agencyId: auth.agencyId, key: 'logoBase64', value: logoBase64 },
    }),
  ])

  return NextResponse.json({ success: true, logoUrl })
}

export async function DELETE() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  // Remove logo file
  const { unlink } = await import('fs/promises')
  for (const e of ['png','jpg','jpeg','webp','svg']) {
    await unlink(path.join(process.cwd(), 'public', `brand-logo.${e}`)).catch(() => null)
  }
  await prisma.settings.deleteMany({ where: { agencyId: auth.agencyId, key: { in: ['logoUrl', 'logoBase64'] } } })
  return NextResponse.json({ success: true })
}
