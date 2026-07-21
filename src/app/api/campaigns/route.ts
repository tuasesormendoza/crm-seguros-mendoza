import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { validateCampaignImages } from '@/lib/campaignImages'

// GET /api/campaigns — historial de campañas (sin las imágenes, que pesan).
export async function GET() {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const [campaigns, withImages] = await Promise.all([
    prisma.campaign.findMany({
      where: { agencyId: auth.agencyId },
      select: {
        id: true, subject: true, message: true, segment: true,
        sentAt: true, sentCount: true, failedCount: true, createdAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    // Ids con imágenes — la bandera se manda sin el peso de las imágenes,
    // que solo se cargan al editar (GET /api/campaigns/[id]).
    prisma.campaign.findMany({
      where: { agencyId: auth.agencyId, images: { not: null } },
      select: { id: true },
    }),
  ])
  const imgSet = new Set(withImages.map(r => r.id))
  return NextResponse.json(campaigns.map(c => ({ ...c, hasImages: imgSet.has(c.id) })))
}

// POST /api/campaigns — guardar borrador (sin enviar).
export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const { subject, message, segment, images, buttonText, buttonUrl } = body
  if (!subject?.trim() && !message?.trim()) {
    return NextResponse.json({ error: 'Escribe al menos el asunto o el mensaje.' }, { status: 400 })
  }
  const imgCheck = validateCampaignImages(images)
  if (imgCheck.error) return NextResponse.json({ error: imgCheck.error }, { status: 400 })

  const campaign = await prisma.campaign.create({
    data: {
      agencyId: auth.agencyId,
      subject: (subject || '').trim(),
      message: (message || '').trim(),
      segment: JSON.stringify(segment || {}),
      images: imgCheck.images.length ? JSON.stringify(imgCheck.images) : null,
      buttonText: buttonText?.trim() || null,
      buttonUrl: buttonUrl?.trim() || null,
    },
    select: { id: true },
  })
  return NextResponse.json(campaign, { status: 201 })
}
