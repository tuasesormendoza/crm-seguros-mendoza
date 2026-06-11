// ─────────────────────────────────────────────────────────────────────────────
// Importación de estados de cuenta de aseguradoras → conciliación automática.
//
// Lógica PURA (sin red, sin DB) para:
//   1. parseStatement: convertir el texto pegado del estado de cuenta en filas
//      { nombre, monto }.
//   2. matchRows: emparejar cada fila con los clientes esperados de esa
//      aseguradora/periodo, usando similitud de nombres tolerante a mayúsculas,
//      acentos y orden de palabras (ej. "VIVAS MARY" ≈ "Mary Vivas").
//
// Se prueba en src/lib/statementImport.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedRow = { rawLine: string; name: string; amount: number }

export type Candidate = { id: string; fullName: string; expected: number }

export type MatchStatus = 'matched' | 'review' | 'unmatched'

export type MatchResult = {
  name: string
  amount: number
  matchedClientId: string | null
  matchedClientName: string | null
  expected: number | null
  score: number
  status: MatchStatus
}

// Convierte "$1,234.50" → 1234.5 ; "18.00" → 18 ; texto no numérico → null
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

// Parsea el texto pegado. Cada línea debe terminar en un monto; el texto previo
// es el nombre. Las líneas sin monto al final (encabezados, totales con texto)
// se ignoran.
export function parseStatement(text: string): ParsedRow[] {
  const rows: ParsedRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    // nombre … separador … monto(al final)
    const m = line.match(/^(.*?)[\s,;:|\t]+\$?\s*(-?[\d.,]+)$/)
    if (!m) continue
    const name = m[1].replace(/["']/g, '').replace(/[,;:|\t\s]+$/, '').trim()
    const amount = parseAmount(m[2])
    if (!name || amount === null) continue
    // Evita confundir un número suelto (ej. una columna de "vidas") como nombre.
    if (!/[a-zA-Z]/.test(name)) continue
    rows.push({ rawLine: line, name, amount })
  }
  return rows
}

// Normaliza un nombre para comparar: minúsculas, sin acentos, solo letras/números
// y espacios simples.
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Similitud por conjunto de palabras (tolerante al orden). 1 = idénticos.
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean))
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

const MATCH_THRESHOLD = 0.75   // ≥ → emparejado automático
const REVIEW_THRESHOLD = 0.5   // entre review y match → sugerencia a revisar

// Empareja cada fila parseada con el mejor candidato (clientes esperados).
export function matchRows(parsed: ParsedRow[], candidates: Candidate[]): MatchResult[] {
  return parsed.map(row => {
    let best: Candidate | null = null
    let bestScore = 0
    for (const c of candidates) {
      const score = nameSimilarity(row.name, c.fullName)
      if (score > bestScore) { bestScore = score; best = c }
    }
    let status: MatchStatus = 'unmatched'
    if (bestScore >= MATCH_THRESHOLD) status = 'matched'
    else if (bestScore >= REVIEW_THRESHOLD) status = 'review'

    const matched = status === 'unmatched' ? null : best
    return {
      name: row.name,
      amount: row.amount,
      matchedClientId: matched ? matched.id : null,
      matchedClientName: matched ? matched.fullName : null,
      expected: matched ? matched.expected : null,
      score: Math.round(bestScore * 100) / 100,
      status,
    }
  })
}
