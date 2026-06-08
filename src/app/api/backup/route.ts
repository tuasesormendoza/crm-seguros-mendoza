import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const dbPath = path.resolve(process.cwd(), 'dev.db')
  const buffer = fs.readFileSync(dbPath)
  const date = new Date().toISOString().split('T')[0]
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="crm-backup-${date}.db"`,
    },
  })
}
