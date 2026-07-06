import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { sendCampaign } from '@/lib/email'
import { buildSegmentWhere, type SegmentParams } from '@/lib/campaignFilters'
import { validateCampaignImages } from '@/lib/campaignImages'
import { logAudit } from '@/lib/audit'

// Tope por envío: protege el límite diario de Gmail (~500) y el tiempo máximo de
// la función serverless. Listas mayores se envían en varias tandas.
const MAX_PER_SEND = 60

// POST /api/campaigns/send — envía una campaña por email al segmento indicado y
// la guarda en el historial (si viene campaignId, actualiza esa campaña).
// Re-consulta los destinatarios en el servidor (no confía en una lista del
// navegador) y solo a quienes tienen email.
export async function POST(request: NextRequest) {
  // Solo admin/agente pueden enviar campañas (no el rol asistente).
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const { subject, message, segment, images, campaignId } = body as {
    subject?: string; message?: string; segment?: SegmentParams
    images?: unknown; campaignId?: string
  }

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'El asunto y el mensaje son obligatorios.' }, { status: 400 })
  }

  const imgCheck = validateCampaignImages(images)
  if (imgCheck.error) return NextResponse.json({ error: imgCheck.error }, { status: 400 })

  const where = buildSegmentWhere(auth.agencyId, segment || {})
  const clients = await prisma.client.findMany({
    where,
    select: { fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  })

  const recipients = clients
    .filter(c => c.email && c.email.trim())
    .map(c => ({ email: c.email!.trim(), name: c.fullName }))

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Ningún cliente del segmento tiene email registrado.' }, { status: 400 })
  }

  const capped = recipients.slice(0, MAX_PER_SEND)

  // Nombre de la agencia para el pie de "baja" (usa el nombre del agente).
  const agentNameRow = await prisma.settings.findFirst({
    where: { agencyId: auth.agencyId, key: 'agentName' }, select: { value: true },
  })
  const agencyName = agentNameRow?.value || 'tu agente de seguros'

  const result = await sendCampaign(auth.agencyId, capped, subject.trim(), message.trim(), agencyName, imgCheck.images)

  // Guardar en el historial: actualiza la campaña editada o crea una nueva.
  const record = {
    subject: subject.trim(),
    message: message.trim(),
    segment: JSON.stringify(segment || {}),
    images: imgCheck.images.length ? JSON.stringify(imgCheck.images) : null,
    sentAt: new Date(),
    sentCount: result.sent,
    failedCount: result.failed,
  }
  let saved = null
  if (campaignId) {
    const updated = await prisma.campaign.updateMany({
      where: { id: campaignId, agencyId: auth.agencyId },
      data: record,
    })
    if (updated.count > 0) saved = { id: campaignId }
  }
  if (!saved) {
    saved = await prisma.campaign.create({ data: { agencyId: auth.agencyId, ...record }, select: { id: true } })
  }

  await logAudit(auth, {
    action: 'send', entity: 'campaign', entityId: saved.id, entityLabel: subject.trim(),
    metadata: { enviados: result.sent, fallidos: result.failed, segmento: segment || {} },
  })

  return NextResponse.json({
    ...result,
    campaignId: saved.id,
    totalConEmail: recipients.length,
    limitados: recipients.length > MAX_PER_SEND ? recipients.length - MAX_PER_SEND : 0,
    maxPorEnvio: MAX_PER_SEND,
  })
}
