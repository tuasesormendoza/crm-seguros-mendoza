// ─────────────────────────────────────────────────────────────────────────────
// Extractor de estados de cuenta en PDF (tablas por columnas).
//
// Recibe los "items" de texto de un PDF (cada uno con su posición x/y y página,
// obtenidos con pdfjs) y reconstruye las filas de la tabla usando la posición
// de las columnas, en vez de depender de líneas perfectas. Esto resuelve dos
// problemas típicos de estos reportes:
//   1. El monto que importa (comisión "Payment") NO está al final de la línea,
//      sino en una columna intermedia.
//   2. El nombre del asegurado a veces se parte en 2 líneas ("MARY VIVAS" + "PAR").
//
// Detecta la columna del nombre ("Insured") y la del monto ("Payment" o
// "Commission") por la posición de sus encabezados, así se adapta a distintos
// formatos de aseguradoras. Lógica PURA y testeable.
// ─────────────────────────────────────────────────────────────────────────────

// Convierte "$1,234.50" → 1234.5 ; "$25.00" → 25 ; texto no numérico → null
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

export type PdfItem = { page: number; x: number; y: number; str: string }

export type StatementExtract = {
  rows: { name: string; amount: number }[]
  insurer: string | null
  period: string | null // "YYYY-MM"
  totalPayment: number | null
}

type Row = { page: number; y: number; cells: { x: number; str: string }[] }

const AMOUNT_RE = /\$\s?-?[\d,]+\.?\d*/

// Texto cercano a una columna x objetivo (con tolerancia), unido por espacios.
function textNear(cells: { x: number; str: string }[], targetX: number, left: number, right: number): string {
  return cells
    .filter(c => c.x >= targetX - left && c.x <= targetX + right)
    .map(c => c.str.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

function groupRows(items: PdfItem[]): Row[] {
  const map = new Map<string, Row>()
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue
    const key = `${it.page}:${Math.round(it.y)}`
    let row = map.get(key)
    if (!row) { row = { page: it.page, y: Math.round(it.y), cells: [] }; map.set(key, row) }
    row.cells.push({ x: Math.round(it.x), str: it.str })
  }
  const rows = [...map.values()]
  for (const r of rows) r.cells.sort((a, b) => a.x - b.x)
  // Orden de lectura: por página, y luego de arriba hacia abajo (y descendente).
  rows.sort((a, b) => a.page - b.page || b.y - a.y)
  return rows
}

// Parsea fechas tipo "1/1/2026" o "1/1/26" → "YYYY-MM"
function toPeriod(s: string): string | null {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  let year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  const month = String(parseInt(m[1], 10)).padStart(2, '0')
  return `${year}-${month}`
}

export function extractStatementRows(items: PdfItem[]): StatementExtract {
  const rows = groupRows(items)

  // 1. Localizar el encabezado: una fila que tenga "Insured" y "Payment"/"Commission".
  let nameX: number | null = null
  let amtX: number | null = null
  let companyX: number | null = null
  let dateX: number | null = null
  let headerIdx = -1

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells
    const insured = cells.find(c => /^insured$/i.test(c.str.trim()))
    const payment = cells.find(c => /^payment$/i.test(c.str.trim())) || cells.find(c => /^commission$/i.test(c.str.trim()))
    if (insured && payment) {
      nameX = insured.x
      amtX = payment.x
      companyX = cells.find(c => /^company$/i.test(c.str.trim()))?.x ?? null
      // El PERIODO se toma de la columna "Coverage Month" (el mes que están
      // pagando), NO de "Effective Date" (cuándo se activó la póliza, que no
      // cambia entre el estado de cuenta de enero y el de febrero). Si no existe
      // Coverage Month, se cae a Effective Date como respaldo.
      dateX = cells.find(c => /coverage/i.test(c.str.trim()))?.x
        ?? cells.find(c => /effective/i.test(c.str.trim()))?.x
        ?? null
      headerIdx = i
      break
    }
  }

  if (nameX === null || amtX === null || headerIdx === -1) {
    return { rows: [], insurer: null, period: null, totalPayment: null }
  }

  const out: { name: string; amount: number }[] = []
  let insurer: string | null = null
  let totalPayment: number | null = null
  // Conteo de "Coverage Month" entre todas las filas → el periodo del estado de
  // cuenta es el mes que más se repite (robusto si alguna fila trae otra fecha).
  const periodCounts = new Map<string, number>()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const cells = row.cells

    // Monto en la columna "Payment"
    const amtCell = cells.find(c => c.x >= amtX - 30 && c.x <= amtX + 55 && AMOUNT_RE.test(c.str))
    const amount = amtCell ? parseAmount(amtCell.str) : null

    // Fragmento de nombre en la columna "Insured"
    const nameFrag = textNear(cells, nameX, 25, 45)

    // Total de la página → captura totalPayment y termina los registros de esa página
    const isTotal = cells.some(c => /total\s*payment/i.test(c.str))
    if (isTotal) {
      const t = cells.find(c => AMOUNT_RE.test(c.str))
      if (t) totalPayment = parseAmount(t.str)
      continue
    }

    if (amount !== null && /[a-zA-Z]/.test(nameFrag)) {
      // Nuevo registro
      out.push({ name: nameFrag, amount })
      // Aseguradora (columna Company) — basta con la primera
      if (insurer === null && companyX !== null) {
        const comp = textNear(cells, companyX, 20, 40)
        if (comp) insurer = comp
      }
      // Coverage Month de esta fila (tolerancia ajustada para no tomar columnas vecinas)
      if (dateX !== null) {
        const pr = toPeriod(textNear(cells, dateX, 15, 30))
        if (pr) periodCounts.set(pr, (periodCounts.get(pr) ?? 0) + 1)
      }
    } else if (amount === null && /[a-zA-Z]/.test(nameFrag) && out.length > 0) {
      // Continuación del nombre de la fila anterior (nombre partido en 2 líneas)
      const last = out[out.length - 1]
      last.name = `${last.name} ${nameFrag}`.replace(/\s+/g, ' ').trim()
    }
  }

  // Periodo dominante (mes que más clientes están pagando en este estado de cuenta)
  let period: string | null = null
  let bestCount = 0
  for (const [p, count] of periodCounts) {
    if (count > bestCount) { bestCount = count; period = p }
  }

  return { rows: out, insurer, period, totalPayment }
}
