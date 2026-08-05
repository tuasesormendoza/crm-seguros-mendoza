import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { getPlatformSettings } from '@/lib/platform'

// GET /api/aptc/counties?zip=30548 — condados que abarca un código postal.
//
// Un ZIP puede cruzar VARIOS condados, y el precio del seguro cambia según el
// condado (cada uno pertenece a un área de tarifa). Por eso, igual que hacen
// cuidadodesalud.gov y Georgia Access, el agente debe elegir el condado del
// cliente cuando hay más de uno.
export async function GET(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const zip = (request.nextUrl.searchParams.get('zip') || '').trim()
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ counties: [] })
  }

  const { cmsApiKey } = await getPlatformSettings(['cmsApiKey'])
  if (!cmsApiKey) return NextResponse.json({ counties: [] })

  try {
    const res = await fetch(
      `https://marketplace.api.healthcare.gov/api/v1/counties/by/zip/${zip}?apikey=${cmsApiKey}`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (!res.ok) return NextResponse.json({ counties: [] })
    const data = await res.json()
    const raw = data.counties || data
    const counties = Array.isArray(raw)
      ? raw.map((c: { name?: string; fips?: string; county_fips?: string; state?: string }) => ({
          name: c.name || '',
          fips: c.fips || c.county_fips || '',
          state: c.state || '',
        })).filter(c => c.name && c.fips)
      : []
    return NextResponse.json({ counties })
  } catch {
    return NextResponse.json({ counties: [] })
  }
}
