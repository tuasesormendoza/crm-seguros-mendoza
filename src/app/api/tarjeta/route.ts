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
Del siguiente texto extraído de un brochure o Summary of Benefits de un plan de salud (puede ser de HealthSherpa, Healthcare.gov u otro portal), extrae la información solicitada.
Devuelve ÚNICAMENTE un objeto JSON válido, sin explicaciones adicionales.

Campos a extraer (usa null si no se encuentra):
{
  "co":    "nombre corto de la aseguradora (ej: Oscar, Ambetter, Molina, UnitedHealthcare)",
  "pname": "nombre completo del plan",
  "pid":   "ID del plan/HIOS Plan ID (ej: 16842GA0100007)",
  "cat":   "Bronze|Silver|Gold|Platinum|Catastrophic",
  "net":   "HMO|PPO|EPO|POS|HDHP",
  "ref":   "Si|No — si requiere referido para ver especialista",
  "ded":   "deducible individual in-network como string ej: $3,200 o $0",
  "oop":   "máximo de bolsillo (out-of-pocket max) individual ej: $8,700 individual",
  "hosp":  "costo hospitalización/admisión inpatient ej: 20% coaseguro o $500 copay",
  "pcp":   "costo visita médico primario (Primary Care/PCP) ej: $0 copay",
  "spec":  "costo visita especialista ej: $40 copay",
  "uc":    "costo urgent care ej: $75 copay",
  "xray":  "costo rayos X (Diagnostic X-ray) ej: $45 copay",
  "ct":    "costo CT scan / PET scan / MRI ej: 20% coaseguro",
  "lab":   "costo laboratorios (lab tests) ej: $30 copay",
  "rx":    "costo medicamentos genéricos tier 1 ej: $3 copay"
}

Nota: si el deducible no aplica para un servicio (por ejemplo PCP $0 copay antes del deducible), usa el copay/coaseguro final.
Para hospitalización busca "Inpatient Hospital", "Hospital Admission" o "Facility Coinsurance".

TEXTO DEL BROCHURE:
${pdfText.slice(0, 12000)}`

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
