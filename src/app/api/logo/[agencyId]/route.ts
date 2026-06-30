import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUBLIC endpoint — no auth. Serves an agency's logo as a real image response
// so it renders in ALL email clients (Gmail, Outlook, Apple Mail). Inline
// base64 `data:` URIs are blocked by Gmail and others, and files written to
// `public/` at runtime are not served by Netlify's CDN — so we store the logo
// bytes in the DB (Settings.logoBase64) and stream them from this stable URL.

type RouteContext = { params: Promise<{ agencyId: string }> }

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]+)$/

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { agencyId } = await ctx.params

  const row = await prisma.settings.findUnique({
    where: { agencyId_key: { agencyId, key: 'logoBase64' } },
    select: { value: true },
  })

  const match = row?.value ? DATA_URL_RE.exec(row.value) : null
  if (!match) {
    return new NextResponse(null, { status: 404 })
  }

  const contentType = match[1]
  const buffer = Buffer.from(match[2], 'base64')

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      // Cache aggressively — Gmail/Outlook proxy and cache the image anyway.
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
