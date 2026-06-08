import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: NextRequest) {
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

  // Save to settings
  await prisma.settings.upsert({
    where: { key: 'logoUrl' },
    update: { value: logoUrl },
    create: { key: 'logoUrl', value: logoUrl },
  })

  return NextResponse.json({ success: true, logoUrl })
}

export async function DELETE() {
  // Remove logo file
  const { unlink } = await import('fs/promises')
  for (const e of ['png','jpg','jpeg','webp','svg']) {
    await unlink(path.join(process.cwd(), 'public', `brand-logo.${e}`)).catch(() => null)
  }
  await prisma.settings.deleteMany({ where: { key: 'logoUrl' } })
  return NextResponse.json({ success: true })
}
