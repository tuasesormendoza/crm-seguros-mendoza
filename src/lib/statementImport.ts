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

export type Candidate = {
  id: string
  fullName: string
  expected: number
  // Nombres alternativos que también resuelven a este cliente — ej. los nombres
  // de sus dependientes (el mercado a veces los pone en una línea aparte del
  // estado de cuenta aunque pertenezcan al mismo grupo familiar).
  aliases?: string[]
}

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

// Tokeniza un nombre, descartando iniciales sueltas (1 letra) como "J" o "F",
// que los estados de cuenta agregan/cortan y solo estorban a la comparación.
// Si al quitarlas no queda nada, se usan todas (caso raro de puras iniciales).
function tokens(s: string): string[] {
  const all = normalizeName(s).split(' ').filter(Boolean)
  const multi = all.filter(t => t.length >= 2)
  return multi.length ? multi : all
}

// ¿La palabra `t` coincide con alguna del conjunto? Exacta, o por prefijo de
// ≥3 letras (los estados de cuenta cortan apellidos: "Par" ≈ "Parra").
function tokenMatches(t: string, set: Set<string>): boolean {
  if (set.has(t)) return true
  if (t.length >= 3) {
    for (const u of set) {
      if (u.length >= 3 && (u.startsWith(t) || t.startsWith(u))) return true
    }
  }
  return false
}

// Similitud por conjunto de palabras (tolerante al orden, mayúsculas, acentos,
// iniciales y apellidos cortados). 1 = idénticos.
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
  let matched = 0
  for (const t of small) if (tokenMatches(t, large)) matched++
  const base = matched / large.size
  // Si TODAS las palabras del nombre más corto (≥2) coinciden, es muy
  // probablemente la misma persona aunque el otro traiga palabras extra.
  if (matched === small.size && small.size >= 2) return Math.max(base, 0.9)
  return base
}

const MATCH_THRESHOLD = 0.75   // ≥ → emparejado automático
const REVIEW_THRESHOLD = 0.5   // entre review y match → sugerencia a revisar

// Empareja cada fila parseada con el mejor candidato (clientes esperados).
export function matchRows(parsed: ParsedRow[], candidates: Candidate[]): MatchResult[] {
  return parsed.map(row => {
    let best: Candidate | null = null
    let bestScore = 0
    for (const c of candidates) {
      // Mejor coincidencia entre el nombre del cliente y sus alias (dependientes).
      const names = [c.fullName, ...(c.aliases ?? [])]
      let score = 0
      for (const n of names) score = Math.max(score, nameSimilarity(row.name, n))
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
