import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { validateCampaignImages } from '@/lib/campaignImages'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/campaigns/[id] — campaña completa (incluye imágenes) para editar.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const campaign = await prisma.campaign.findFirst({ where: { id, agencyId: auth.agencyId } })
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 })
  return NextResponse.json(campaign)
}

// PUT /api/campaigns/[id] — actualizar borrador/campaña (sin enviar).
export async function PUT(request: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const { subject, message, segment, images } = body
  const imgCheck = validateCampaignImages(images)
  if (imgCheck.error) return NextResponse.json({ error: imgCheck.error }, { status: 400 })

  const res = await prisma.campaign.updateMany({
    where: { id, agencyId: auth.agencyId },
    data: {
      subject: (subject || '').trim(),
      message: (message || '').trim(),
      segment: JSON.stringify(segment || {}),
      images: imgCheck.images.length ? JSON.stringify(imgCheck.images) : null,
    },
  })
  if (res.count === 0) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/campaigns/[id]
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params
  const res = await prisma.campaign.deleteMany({ where: { id, agencyId: auth.agencyId } })
  if (res.count === 0) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
