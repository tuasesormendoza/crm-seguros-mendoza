import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { getPlatformSetting } from '@/lib/platform'

export async function POST(request: NextRequest) {
  const auth = await getAuth()
  if (auth instanceof NextResponse) return auth

  const { pdfText } = await request.json()

  if (!pdfText) return NextResponse.json({ error: 'No se recibió texto del PDF' }, { status: 400 })

  // La clave de IA es de PLATAFORMA (la controla el dueño del CRM). Ver src/lib/platform.ts.
  const apiKey = await getPlatformSetting('anthropicApiKey')

  if (!apiKey) {
    return NextResponse.json({
      error: 'La generación con IA no está disponible: falta configurar la clave de IA del CRM (la administra el proveedor del sistema).'
    }, { status: 400 })
  }

  const prompt = `Eres un experto en seguros médicos ACA/Obamacare en los Estados Unidos.
Del siguiente texto extraído de un brochure de plan de salud, extrae la información solicitada.
Devuelve ÚNICAMENTE un objeto JSON válido, sin explicaciones adicionales.

Campos a extraer (usa null si no se encuentra):
{
  "co":   "nombre de la aseguradora",
  "pname":"nombre completo del plan",
  "cat":  "Bronze|Silver|Gold|Platinum|Catastrophic",
  "net":  "HMO|PPO|EPO|POS|HDHP",
  "ref":  "Si|No",
  "ded":  "deducible como string ej: $3,200",
  "oop":  "desembolso máximo de bolsillo ej: $8,700",
  "hosp": "coaseguro hospitalización ej: 20% coaseguro",
  "pcp":  "costo médico primario ej: $0 copay",
  "spec": "costo especialista ej: $40 copay",
  "uc":   "costo urgent care ej: $75 copay",
  "xray": "costo rayos X ej: $45 copay",
  "ct":   "costo CT/PET/MRI ej: 20% coaseguro",
  "lab":  "costo laboratorios ej: $30 copay",
  "rx":   "costo medicinas genéricas tier 1 ej: $3 copay"
}

TEXTO DEL BROCHURE:
${pdfText.slice(0, 9000)}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    return NextResponse.json({
      error: 'Error de Claude API: ' + (e.error?.message || res.statusText)
    }, { status: 502 })
  }

  const json = await res.json()
  const raw = json.content[0].text
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Claude no devolvió JSON válido.' }, { status: 502 })

  return NextResponse.json(JSON.parse(match[0]))
}
