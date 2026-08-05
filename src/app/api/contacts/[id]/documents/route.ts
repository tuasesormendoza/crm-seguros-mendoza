import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveFile } from '@/lib/storage'
import { randomUUID } from 'crypto'
import { getAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

// Documentos que cuelgan de un contacto de la agenda (no de un cliente).
// Caso típico: el formulario ETF que hay que llenar y enviarle por email a
// Washington National.

type RouteContext = { params: Promise<{ id: string }> }

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const docs = await prisma.document.findMany({
    where: { contactId: id, agencyId: auth.agencyId },
    orderBy: { uploadedAt: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const contact = await prisma.contact.findFirst({ where: { id, agencyId: auth.agencyId } })
  if (!contact) return NextResponse.json({ error: 'Contacto no encontrado.' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const category = (formData.get('category') as string) || 'Otro'
  const notes = (formData.get('notes') as string) || ''

  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PDF, imágenes o documentos Word/Excel.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storedName = `${randomUUID()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  await saveFile(id, storedName, buffer)

  const doc = await prisma.document.create({
    data: {
      contactId: id,
      agencyId: auth.agencyId,
      fileName: file.name,
      storedName,
      fileSize: file.size,
      mimeType: file.type,
      category,
      notes: notes || null,
    },
  })

  await logAudit(auth, { action: 'create', entity: 'document', entityId: doc.id, entityLabel: doc.fileName, metadata: { contactId: id, category } })
  return NextResponse.json(doc, { status: 201 })
}
