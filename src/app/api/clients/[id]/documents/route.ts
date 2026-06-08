import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { randomUUID } from 'crypto'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params
  const docs = await prisma.document.findMany({
    where: { clientId: id },
    orderBy: { uploadedAt: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/clients/[id]'>) {
  const { id } = await ctx.params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) || 'Otro'
  const notes = (formData.get('notes') as string) || ''

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PDF, imágenes o documentos Word/Excel.' }, { status: 400 })
  }

  // Build stored filename: uuid + original extension
  const ext = file.name.split('.').pop() ?? 'bin'
  const storedName = `${randomUUID()}.${ext}`

  // Store via Netlify Blobs in production (filesystem is ephemeral on
  // serverless), or locally in uploads/{clientId}/ during development.
  const buffer = Buffer.from(await file.arrayBuffer())
  await saveFile(id, storedName, buffer)

  const doc = await prisma.document.create({
    data: {
      clientId: id,
      fileName: file.name,
      storedName,
      fileSize: file.size,
      mimeType: file.type,
      category,
      notes: notes || null,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
