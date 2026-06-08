import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { decryptClientFields } from '@/lib/encrypt'

// Exports all CRM data as a downloadable JSON file.
// The old SQLite backup (dev.db) no longer exists — we now use Neon/Postgres.
// This endpoint exports all tables so you can restore or migrate data if needed.

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
    prisma.client.findMany({ orderBy: { fullName: 'asc' } }),
    prisma.dependent.findMany(),
    prisma.document.findMany(),
    prisma.appointment.findMany(),
    prisma.activity.findMany(),
    prisma.policyHistory.findMany(),
    prisma.prospect.findMany(),
    prisma.commissionRate.findMany(),
    prisma.settings.findMany(),
    prisma.notificationLog.findMany(),
    // Export users without passwords for security
    prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true } }),
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
