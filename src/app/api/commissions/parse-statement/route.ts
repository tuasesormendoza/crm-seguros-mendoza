import { NextRequest, NextResponse } from 'next/server'
import { requireRole, COMMISSIONS_ROLES } from '@/lib/auth'
import { extractStatementRows, type PdfItem } from '@/lib/pdfStatement'

// Recibe un estado de cuenta en PDF, extrae el texto con pdfjs y devuelve los
// clientes + montos detectados, junto con la aseguradora y el periodo. El
// emparejamiento contra los clientes y la conciliación se hacen en el cliente
// (reutilizando la lógica existente).

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_SIZE = 15 * 1024 * 1024 // 15 MB

export async function POST(request: NextRequest) {
  const auth = await requireRole(COMMISSIONS_ROLES)
  if (auth instanceof NextResponse) return auth

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo PDF.' }, { status: 400 })
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'El archivo debe ser un PDF.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El PDF supera el límite de 15 MB.' }, { status: 400 })
  }

  try {
    // Carga diferida de pdfjs (paquete externo del servidor) — build legacy para Node.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(await file.arrayBuffer())
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise

    const items: PdfItem[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const tc = await page.getTextContent()
      for (const it of tc.items as { str?: string; transform?: number[] }[]) {
        if (it.str && it.str.trim() && it.transform) {
          items.push({ page: p, x: it.transform[4], y: it.transform[5], str: it.str })
        }
      }
    }

    const result = extractStatementRows(items)
    if (result.rows.length === 0) {
      return NextResponse.json({
        error: 'No se pudo reconocer la tabla del estado de cuenta. Asegúrate de que el PDF tenga columnas "Insured" y "Payment" (o usa el modo de pegar texto).',
      }, { status: 422 })
    }
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'No se pudo leer el PDF: ' + msg.slice(0, 150) }, { status: 500 })
  }
}
