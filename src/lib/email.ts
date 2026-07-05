import nodemailer from 'nodemailer'
import { prisma } from './prisma'

// Multi-tenant: la configuración de email (SMTP) es POR AGENCIA. Siempre se debe
// pasar el agencyId para no mezclar credenciales entre inquilinos.
export async function getEmailConfig(agencyId: string) {
  const rows = await prisma.settings.findMany({
    where: { agencyId, key: { in: ['emailEnabled','emailFrom','emailTo','smtpHost','smtpPort','smtpUser','smtpPass'] } }
  })
  const map: Record<string,string> = {}
  rows.forEach(r => { map[r.key] = r.value })
  return {
    enabled: map.emailEnabled === 'true',
    from: map.emailFrom || map.emailTo || '',
    to: map.emailTo || '',
    host: map.smtpHost || 'smtp.gmail.com',
    port: parseInt(map.smtpPort || '587'),
    user: map.smtpUser || '',
    pass: map.smtpPass || '',
  }
}

export async function sendEmail(agencyId: string, subject: string, html: string) {
  const cfg = await getEmailConfig(agencyId)
  if (!cfg.enabled || !cfg.to || !cfg.user || !cfg.pass) return { sent: false, reason: 'Email not configured' }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
  })

  await transporter.sendMail({
    from: cfg.from || cfg.user,
    to: cfg.to,
    subject,
    html,
  })
  return { sent: true }
}

// ── Campañas (envío masivo a CLIENTES) ───────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Convierte el texto plano de la campaña (con {nombre}) en HTML seguro.
function renderCampaignHtml(body: string, firstName: string, agencyName: string): string {
  const personalized = body.replace(/\{nombre\}/g, firstName)
  const htmlBody = escapeHtml(personalized).replace(/\n/g, '<br>')
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
    ${htmlBody}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="font-size:11px;color:#9ca3af">
      Recibes este mensaje porque eres cliente de ${escapeHtml(agencyName)}.
      Si no deseas recibir más comunicaciones, responde a este correo con la palabra <strong>BAJA</strong>.
    </p>
  </div>`
}

export interface CampaignRecipient { email: string; name: string }

// Envía una campaña a varios clientes reutilizando una sola conexión SMTP en
// pool (rápido y sin abrir/cerrar por correo). Personaliza {nombre} y agrega un
// pie con opción de baja. Devuelve conteos y los primeros errores.
export async function sendCampaign(
  agencyId: string,
  recipients: CampaignRecipient[],
  subject: string,
  body: string,
  agencyName: string,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const cfg = await getEmailConfig(agencyId)
  if (!cfg.enabled || !cfg.user || !cfg.pass) {
    return { sent: 0, failed: recipients.length, errors: ['El email no está configurado en Configuración → Notificaciones por Email.'] }
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    pool: true,
    maxConnections: 5,
    tls: { rejectUnauthorized: false },
  })

  let sent = 0, failed = 0
  const errors: string[] = []
  await Promise.all(recipients.map(async r => {
    try {
      await transporter.sendMail({
        from: cfg.from || cfg.user,
        to: r.email,
        subject: subject.replace(/\{nombre\}/g, r.name.split(' ')[0]),
        html: renderCampaignHtml(body, r.name.split(' ')[0], agencyName),
      })
      sent++
    } catch (err) {
      failed++
      if (errors.length < 5) errors.push(`${r.email}: ${err instanceof Error ? err.message : 'error'}`)
    }
  }))
  transporter.close()
  return { sent, failed, errors }
}
