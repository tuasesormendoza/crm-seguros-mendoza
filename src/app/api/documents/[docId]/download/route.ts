import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/documents/[docId]'>) {
  const { docId } = await ctx.params

  const doc = await prisma.document.findUnique({ where: { id: docId } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const filePath = path.join(process.cwd(), 'uploads', doc.clientId, doc.storedName)

  try {
    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo no encontrado en el servidor' }, { status: 404 })
  }
}
