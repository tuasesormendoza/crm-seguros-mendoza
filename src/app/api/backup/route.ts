import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptClientFields } from '@/lib/encrypt'
import { requireAdmin } from '@/lib/auth'

// Exports all CRM data as a downloadable JSON file.
// The old SQLite backup (dev.db) no longer exists — we now use Neon/Postgres.
// This endpoint exports all tables so you can restore or migrate data if needed.
// Multi-tenant: solo exporta los datos de la agencia del admin que lo solicita.

export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth
  const agencyId = auth.agencyId

  const [
    clients,
    dependents,
    documents,
    appointments,
    activities,
    policyHistory,
    prospects,
    commissionRates,
    settings,
    notificationLog,
    users,
  ] = await Promise.all([
    prisma.client.findMany({ where: { agencyId }, orderBy: { fullName: 'asc' } }),
    prisma.dependent.findMany({ where: { agencyId } }),
    prisma.document.findMany({ where: { agencyId } }),
    prisma.appointment.findMany({ where: { agencyId } }),
    prisma.activity.findMany({ where: { agencyId } }),
    prisma.policyHistory.findMany({ where: { agencyId } }),
    prisma.prospect.findMany({ where: { agencyId } }),
    prisma.commissionRate.findMany({ where: { agencyId } }),
    prisma.settings.findMany({ where: { agencyId } }),
    prisma.notificationLog.findMany({ where: { agencyId } }),
    // Export users without passwords for security
    prisma.user.findMany({ where: { agencyId }, select: { id: true, email: true, name: true, role: true, active: true, createdAt: true } }),
  ])

  const backup = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    database: 'postgresql/neon',
    tables: {
      clients: { count: clients.length, data: clients.map(decryptClientFields) },
      dependents: { count: dependents.length, data: dependents },
      documents: { count: documents.length, data: documents },
      appointments: { count: appointments.length, data: appointments },
      activities: { count: activities.length, data: activities },
      policyHistory: { count: policyHistory.length, data: policyHistory },
      prospects: { count: prospects.length, data: prospects },
      commissionRates: { count: commissionRates.length, data: commissionRates },
      settings: { count: settings.length, data: settings },
      notificationLog: { count: notificationLog.length, data: notificationLog },
      users: { count: users.length, data: users },
    },
  }

  const date = new Date().toISOString().split('T')[0]
  const json = JSON.stringify(backup, null, 2)

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="crm-backup-${date}.json"`,
      'Content-Length': String(Buffer.byteLength(json, 'utf8')),
    },
  })
}
