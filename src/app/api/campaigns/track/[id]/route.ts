import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Pixel de seguimiento de apertura (público, sin sesión: lo carga el cliente de
// correo del destinatario). Incrementa el contador de aperturas de la campaña y
// devuelve un GIF transparente 1x1. No expone ningún dato.

// GIF transparente 1x1.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  // Solo incrementa un contador por id de campaña; no filtra datos entre agencias.
  await prisma.campaign.updateMany({ where: { id }, data: { openCount: { increment: 1 } } }).catch(() => {})
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}
