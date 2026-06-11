import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFileBuffer } from '@/lib/storage'
import { getAuth } from '@/lib/auth'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/documents/[docId]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const { docId } = await ctx.params
  const doc = await prisma.document.findFirst({ where: { id: docId, agencyId: auth.agencyId } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const buffer = await readFileBuffer(doc.clientId, doc.storedName)
    return new NextResponse(new Uint8Array(buffer), {
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
