import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/storage'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/documents/[docId]'>) {
  const { docId } = await ctx.params

  const doc = await prisma.document.findUnique({ where: { id: docId } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete physical/blob file
  await deleteFile(doc.clientId, doc.storedName)

  await prisma.document.delete({ where: { id: docId } })
  return NextResponse.json({ success: true })
}
