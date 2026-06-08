import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/documents/[docId]'>) {
  const { docId } = await ctx.params

  const doc = await prisma.document.findUnique({ where: { id: docId } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete physical file
  const filePath = path.join(process.cwd(), 'uploads', doc.clientId, doc.storedName)
  await unlink(filePath).catch(() => null) // ignore if already gone

  await prisma.document.delete({ where: { id: docId } })
  return NextResponse.json({ success: true })
}
