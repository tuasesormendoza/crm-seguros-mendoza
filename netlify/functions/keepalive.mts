// Netlify Scheduled Function — keep-alive.
//
// Runs every 4 minutes and pings the app's public /api/ping endpoint, which
// executes a lightweight `SELECT 1`. This keeps BOTH the Next.js server handler
// (the shared Lambda that serves pages and API routes) and the Neon Postgres
// connection warm, so real users don't pay a cold-start penalty.
//
// Neon's free tier suspends the database after ~5 minutes of inactivity, so we
// ping just under that window. No external cron service (cron-job.org, etc.)
// is needed — Netlify runs this on its own schedule.

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || ''
  if (!base) return new Response('no site URL available', { status: 500 })
  try {
    const res = await fetch(`${base}/api/ping`)
    return new Response(`pinged /api/ping → ${res.status}`)
  } catch {
    return new Response('ping failed', { status: 502 })
  }
}

// Cron: every 4 minutes. Netlify allows at most once per minute; 4 min stays
// safely under Neon's ~5 min suspend window.
export const config = {
  schedule: '*/4 * * * *',
}
