import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { sendCampaign } from '@/lib/email'
import { getCampaignBrand } from '@/lib/campaignBrand'
import { buildSegmentWhere, smartPostFilter, type SegmentParams } from '@/lib/campaignFilters'
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
  const agencyId = auth.agencyId

  const body = await request.json().catch(() => ({}))
  const { subject, message, segment, images, campaignId, buttonText, buttonUrl, scheduledAt } = body as {
    subject?: string; message?: string; segment?: SegmentParams
    images?: unknown; campaignId?: string; buttonText?: string; buttonUrl?: string; scheduledAt?: string
  }
  const button = buttonText?.trim() && buttonUrl?.trim() ? { text: buttonText.trim(), url: buttonUrl.trim() } : null

  const imgCheck = validateCampaignImages(images)
  if (imgCheck.error) return NextResponse.json({ error: imgCheck.error }, { status: 400 })

  // Se puede enviar con solo imágenes: el mensaje no es obligatorio si hay al
  // menos una imagen (útil para volantes/flyers). El asunto sí se pide.
  if (!subject?.trim() || (!message?.trim() && imgCheck.images.length === 0)) {
    return NextResponse.json({ error: 'Escribe un asunto y al menos un mensaje o una imagen.' }, { status: 400 })
  }

  const msg = (message || '').trim()
  const baseRecord = {
    subject: subject.trim(),
    message: msg,
    segment: JSON.stringify(segment || {}),
    images: imgCheck.images.length ? JSON.stringify(imgCheck.images) : null,
    buttonText: button?.text || null,
    buttonUrl: button?.url || null,
  }

  // Crea o actualiza (si es una campaña editada) el registro, aplicando `extra`.
  async function upsertCampaign(extra: Record<string, unknown>): Promise<string | null> {
    if (campaignId) {
      const r = await prisma.campaign.updateMany({ where: { id: campaignId, agencyId }, data: { ...baseRecord, ...extra } })
      if (r.count > 0) return campaignId
    }
    const c = await prisma.campaign.create({ data: { agencyId, ...baseRecord, ...extra }, select: { id: true } })
    return c.id
  }

  // ── Envío PROGRAMADO: si la fecha es a futuro, se guarda y el cron la envía ──
  const when = scheduledAt ? new Date(scheduledAt) : null
  if (when && !isNaN(when.getTime()) && when.getTime() > Date.now() + 60_000) {
    const id = await upsertCampaign({ scheduledAt: when, sentAt: null })
    if (!id) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 })
    await logAudit(auth, { action: 'send', entity: 'campaign', entityId: id, entityLabel: subject.trim(), metadata: { programada: when.toISOString() } })
    return NextResponse.json({ scheduled: true, scheduledAt: when.toISOString(), campaignId: id })
  }

  // ── Envío INMEDIATO ──
  const where = buildSegmentWhere(auth.agencyId, segment || {})
  const all = await prisma.client.findMany({
    where,
    select: { fullName: true, email: true, insurer: true, planName: true, state: true, birthDate: true },
    orderBy: { fullName: 'asc' },
  })
  const recipients = smartPostFilter(all, segment || {})
    .filter(c => c.email && c.email.trim())
    .map(c => ({ email: c.email!.trim(), name: c.fullName, insurer: c.insurer, planName: c.planName, state: c.state }))

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Ningún cliente del segmento tiene email registrado.' }, { status: 400 })
  }
  const capped = recipients.slice(0, MAX_PER_SEND)

  // Guardar el registro ANTES de enviar (necesario para el pixel de apertura).
  const id = await upsertCampaign({ scheduledAt: null })
  if (!id) return NextResponse.json({ error: 'Campaña no encontrada.' }, { status: 404 })

  const brand = await getCampaignBrand(auth.agencyId, request.nextUrl.origin)
  const trackUrl = `${request.nextUrl.origin}/api/campaigns/track/${id}`
  const result = await sendCampaign(auth.agencyId, capped, subject.trim(), msg, brand, imgCheck.images, button, trackUrl)

  await prisma.campaign.updateMany({
    where: { id, agencyId: auth.agencyId },
    data: { sentAt: new Date(), sentCount: result.sent, failedCount: result.failed, scheduledAt: null },
  })

  await logAudit(auth, {
    action: 'send', entity: 'campaign', entityId: id, entityLabel: subject.trim(),
    metadata: { enviados: result.sent, fallidos: result.failed, segmento: segment || {} },
  })

  return NextResponse.json({
    ...result,
    campaignId: id,
    totalConEmail: recipients.length,
    limitados: recipients.length > MAX_PER_SEND ? recipients.length - MAX_PER_SEND : 0,
    maxPorEnvio: MAX_PER_SEND,
  })
}
