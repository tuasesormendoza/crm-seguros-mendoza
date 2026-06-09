// Keep-alive endpoint for Neon free tier.
// Neon suspends the DB after ~5 min of inactivity, causing a cold-start delay
// on the next real request. This endpoint sends a lightweight query to keep
// the connection warm.
//
// Set up a free cron at https://cron-job.org to call this URL every 4 minutes:
//   GET https://<your-site>.netlify.app/api/ping
//
// This route is intentionally public (no auth required) — it exposes no data.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$executeRaw`SELECT 1`
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
