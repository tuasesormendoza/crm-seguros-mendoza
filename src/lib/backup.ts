// ─────────────────────────────────────────────────────────────────────────────
// Exportación de los datos de una agencia como objeto JSON (respaldo restaurable).
//
// SEGURIDAD: a diferencia del respaldo manual que el admin descarga a su propia
// máquina (/api/backup, que descifra), este respaldo va a la NUBE (Google Drive)
// y corre solo. Por eso los campos sensibles (SSN, datos bancarios, contraseña
// del portal) se dejan TAL CUAL están en la base de datos: CIFRADOS. El respaldo
// sigue siendo 100% restaurable (con la misma llave de cifrado de la app), pero
// un archivo en Drive nunca contiene datos personales en claro.
//
// También se filtran de `settings` las llaves que parezcan secretos (API keys,
// contraseñas SMTP, etc.) para no subir credenciales a Drive.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

// Llaves de configuración que NO se respaldan a la nube (secretos operativos).
const SECRET_SETTING_RE = /(key|secret|pass|token|apikey)/i

export interface AgencyBackup {
  exportedAt: string
  version: string
  database: string
  agencyId: string
  tables: Record<string, { count: number; data: unknown[] }>
}

// Exporta todos los datos de negocio de una agencia. Deliberadamente NO incluye:
//  - Los bytes de los documentos (viven en almacenamiento aparte; aquí va su metadata).
//  - Las imágenes inline de las campañas (pesan mucho; se conserva el resto).
//  - Tokens de Google ni el log de auditoría (transitorios / regenerables / enormes).
export async function exportAgencyBackup(agencyId: string): Promise<AgencyBackup> {
  const [
    clients,
    dependents,
    documents,
    appointments,
    activities,
    policyHistory,
    insurerHistory,
    prospects,
    commissionRates,
    commissionPayments,
    commissionChecks,
    calendarEvents,
    claims,
    campaigns,
    settings,
    notificationLog,
    surveyResponses,
    users,
  ] = await Promise.all([
    prisma.client.findMany({ where: { agencyId }, orderBy: { fullName: 'asc' } }),
    prisma.dependent.findMany({ where: { agencyId } }),
    prisma.document.findMany({ where: { agencyId } }),
    prisma.appointment.findMany({ where: { agencyId } }),
    prisma.activity.findMany({ where: { agencyId } }),
    prisma.policyHistory.findMany({ where: { agencyId } }),
    prisma.insurerHistory.findMany({ where: { agencyId } }),
    prisma.prospect.findMany({ where: { agencyId } }),
    prisma.commissionRate.findMany({ where: { agencyId } }),
    prisma.commissionPayment.findMany({ where: { agencyId } }),
    prisma.commissionCheck.findMany({ where: { agencyId } }),
    prisma.calendarEvent.findMany({ where: { agencyId } }),
    prisma.claim.findMany({ where: { agencyId } }),
    // Campañas SIN el blob de imágenes (se guarda una bandera de si tenían).
    prisma.campaign.findMany({
      where: { agencyId },
      select: {
        id: true, subject: true, message: true, segment: true, images: true,
        sentAt: true, sentCount: true, failedCount: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.settings.findMany({ where: { agencyId } }),
    prisma.notificationLog.findMany({ where: { agencyId } }),
    prisma.surveyResponse.findMany({ where: { agencyId } }),
    // Usuarios SIN contraseña.
    prisma.user.findMany({
      where: { agencyId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    }),
  ])

  const safeCampaigns = campaigns.map(c => {
    const { images, ...rest } = c
    return { ...rest, hasImages: !!images }
  })
  const safeSettings = settings.filter(s => !SECRET_SETTING_RE.test(s.key))

  return {
    exportedAt: new Date().toISOString(),
    version: '2.1',
    database: 'postgresql/neon',
    agencyId,
    tables: {
      clients: { count: clients.length, data: clients },
      dependents: { count: dependents.length, data: dependents },
      documents: { count: documents.length, data: documents },
      appointments: { count: appointments.length, data: appointments },
      activities: { count: activities.length, data: activities },
      policyHistory: { count: policyHistory.length, data: policyHistory },
      insurerHistory: { count: insurerHistory.length, data: insurerHistory },
      prospects: { count: prospects.length, data: prospects },
      commissionRates: { count: commissionRates.length, data: commissionRates },
      commissionPayments: { count: commissionPayments.length, data: commissionPayments },
      commissionChecks: { count: commissionChecks.length, data: commissionChecks },
      calendarEvents: { count: calendarEvents.length, data: calendarEvents },
      claims: { count: claims.length, data: claims },
      campaigns: { count: safeCampaigns.length, data: safeCampaigns },
      settings: { count: safeSettings.length, data: safeSettings },
      notificationLog: { count: notificationLog.length, data: notificationLog },
      surveyResponses: { count: surveyResponses.length, data: surveyResponses },
      users: { count: users.length, data: users },
    },
  }
}
