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
