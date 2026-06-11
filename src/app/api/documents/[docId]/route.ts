import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/storage'
import { getAuth } from '@/lib/auth'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/documents/[docId]'>) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth
  const { docId } = await ctx.params

  const doc = await prisma.document.findFirst({ where: { id: docId, agencyId: auth.agencyId } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete physical/blob file
  await deleteFile(doc.clientId, doc.storedName)

  await prisma.document.delete({ where: { id: docId } })
  return NextResponse.json({ success: true })
}
