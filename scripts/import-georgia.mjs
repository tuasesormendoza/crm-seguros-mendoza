// ─────────────────────────────────────────────────────────────────────────────
// IMPORTA LOS DATOS DEL MERCADO DE GEORGIA (Georgia Access)
//
// Georgia no está en la API federal de CMS ("state is not a valid marketplace
// state"), pero el estado publica archivos oficiales de uso público (PUF) en
// CSV, sin llave ni registro. Este script los descarga, los cruza y guarda en
// la tabla GeorgiaMarketData una fila por (año, área de tarifa) con:
//   • los planes de esa área (nombre, aseguradora, metal, tipo, deducible, MOOP,
//     copagos de médico primario/especialista/urgencias/emergencia/genéricos)
//   • sus tarifas mensuales por edad
//
// Con eso la Calculadora APTC de Georgia funciona igual que la de los estados
// federales: precio exacto por ZIP, SLCSP real y mejores planes.
//
// USO (las tarifas nuevas salen cada otoño para el AEP):
//   node --env-file=.env scripts/import-georgia.mjs
//   node --env-file=.env scripts/import-georgia.mjs --year 2027
//
// Los enlaces de los archivos se descubren solos desde la página de PUF, así
// que no hay que actualizarlos a mano cada año.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '../src/generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const PUF_PAGE = 'https://georgiaaccess.gov/public-use-files/'
const BASE = 'https://georgiaaccess.gov'

const argYear = process.argv.includes('--year')
  ? parseInt(process.argv[process.argv.indexOf('--year') + 1], 10)
  : null
const YEAR = argYear || new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0)

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })

// ── CSV: parser que respeta comillas y comas dentro de campos ────────────────
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  if (!rows.length) return []
  const header = rows[0].map(h => h.trim())
  return rows.slice(1).filter(r => r.length > 1).map(r => {
    const o = {}
    header.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
    return o
  })
}

async function fetchText(url, label) {
  process.stdout.write(`   ↓ ${label}... `)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`)
  const t = await res.text()
  console.log(`${(t.length / 1e6).toFixed(1)} MB`)
  return t
}

// Descubre los enlaces de los PUF del año pedido desde la página oficial.
async function discoverFiles(year) {
  const html = await (await fetch(PUF_PAGE)).text()
  const hrefs = [...html.matchAll(/href="([^"]+\.csv)"/gi)].map(m => m[1])
  const pick = prefix => {
    // Ej: RATE-PUF_20250926212630_2026.csv → se elige el más reciente del año.
    const matches = hrefs.filter(h => {
      const f = h.split('/').pop() || ''
      return f.toUpperCase().startsWith(prefix + '-PUF_') && f.includes(`_${year}.csv`)
    })
    if (!matches.length) return null
    matches.sort() // el nombre lleva la marca de tiempo → el último es el más nuevo
    const rel = matches[matches.length - 1]
    return rel.startsWith('http') ? rel : BASE + rel
  }
  return { rate: pick('RATE'), plan: pick('PLAN'), bencs: pick('BENCS'), sa: pick('SA') }
}

// Nombre del beneficio en el PUF → clave que usa el CRM.
const BENEFIT_KEYS = {
  'Primary Care Visit to Treat an Injury or Illness': 'primaryCare',
  'Specialist Visit': 'specialist',
  'Urgent Care Centers or Facilities': 'urgentCare',
  'Emergency Room Services': 'emergencyRoom',
  'Generic Drugs': 'genericDrugs',
}

const money = v => {
  const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

// "$30" + "20%" → texto corto para mostrar ("$30 copago", "20% coaseguro").
function costShare(copay, coins) {
  const c = (copay || '').trim(), co = (coins || '').trim()
  const parts = []
  if (c && !/^no charge$/i.test(c) && c !== '$0.00') parts.push(c.replace(/\.00$/, '') + ' copago')
  else if (/^no charge$/i.test(c) || c === '$0.00') parts.push('Sin costo')
  if (co && co !== '0%' && !/^no charge$/i.test(co)) parts.push(co + ' coaseguro')
  return parts.join(' + ') || null
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
  console.log(`\n📥 Importando datos de Georgia Access — año ${YEAR}\n`)

  const files = await discoverFiles(YEAR)
  if (!files.rate || !files.plan) {
    throw new Error(`No se encontraron los archivos del año ${YEAR} en ${PUF_PAGE}. ` +
      `Revisa si ya se publicaron (rate=${files.rate}, plan=${files.plan}).`)
  }

  const [planCsv, rateCsv, bencsCsv, saCsv] = await Promise.all([
    fetchText(files.plan, 'PLAN-PUF (planes)'),
    fetchText(files.rate, 'RATE-PUF (tarifas)'),
    files.bencs ? fetchText(files.bencs, 'BENCS-PUF (copagos)') : Promise.resolve(''),
    files.sa ? fetchText(files.sa, 'SA-PUF (áreas de servicio)') : Promise.resolve(''),
  ])

  // ── Áreas de servicio: qué condados cubre realmente cada plan ──────────────
  // Muchos planes existen en un área de tarifa pero NO se venden en todos sus
  // condados. Sin esto se cotizarían planes que el cliente no puede comprar.
  const serviceAreas = {}   // "issuerId|saId" → "ALL" | [FIPS de condados]
  if (saCsv) {
    const tmp = new Map()
    for (const r of parseCsv(saCsv)) {
      const key = `${r.IssuerId}|${r.ServiceAreaId}`
      const d = tmp.get(key) || { entire: false, counties: new Set() }
      if (/^yes$/i.test(r.CoverEntireState || '')) d.entire = true
      if ((r.County || '').trim()) d.counties.add(r.County.trim())
      tmp.set(key, d)
    }
    for (const [k, d] of tmp) serviceAreas[k] = d.entire ? 'ALL' : [...d.counties]
    console.log(`   ✔ ${Object.keys(serviceAreas).length} áreas de servicio`)
  }

  // ── Planes: se usa la variante estándar (-01), que es el plan sin CSR ──────
  console.log('\n   Procesando planes...')
  // Niveles metálicos de planes de SALUD. Los dentales usan "High"/"Low" y se
  // descartan: no son planes médicos y no cuentan para el SLCSP ni se cotizan.
  const HEALTH_METALS = new Set(['Bronze', 'Expanded Bronze', 'Silver', 'Gold', 'Platinum', 'Catastrophic'])

  const plans = new Map() // planId base → datos
  let dentalSkipped = 0
  for (const r of parseCsv(planCsv)) {
    const full = (r.PlanId || '').trim()
    if (!full) continue
    if (!HEALTH_METALS.has((r.MetalLevel || '').trim())) { dentalSkipped++; continue }
    const base = full.split('-')[0]
    const variant = (r.CSRVariationType || '')
    // Solo la variante estándar; las CSR (73/87/94%) comparten la misma tarifa.
    if (!/standard/i.test(variant) && plans.has(base)) continue
    plans.set(base, {
      id: base,
      name: r.PlanMarketingName || base,
      issuer: r.IssuerMarketPlaceMarketingName || null,
      metalLevel: r.MetalLevel || '',
      type: r.PlanType || '',
      deductible: money(r.TEHBDedInnTier1Individual ?? r.MEHBDedInnTier1Individual),
      moop: money(r.TEHBInnTier1IndividualMOOP ?? r.MEHBInnTier1IndividualMOOP),
      hsaEligible: /hsa/i.test(r.HSAEligible || '') || /^yes$/i.test(r.HSAEligible || ''),
      sa: `${r.IssuerId}|${r.ServiceAreaId || ''}`,   // para filtrar por condado
    })
  }
  console.log(`   ✔ ${plans.size} planes de salud (${dentalSkipped} dentales/otros descartados)`)

  // ── Copagos por beneficio (solo de la variante estándar) ──────────────────
  if (bencsCsv) {
    let n = 0
    for (const r of parseCsv(bencsCsv)) {
      const key = BENEFIT_KEYS[r.BenefitName]
      if (!key) continue
      const base = (r.PlanId || '').split('-')[0]
      const p = plans.get(base)
      if (!p) continue
      if (p[key] == null) { p[key] = costShare(r.CopayInnTier1, r.CoinsInnTier1); n++ }
    }
    console.log(`   ✔ ${n} copagos de beneficios`)
  }

  // ── Tarifas por área y edad ───────────────────────────────────────────────
  console.log('   Procesando tarifas...')
  const byArea = new Map() // área → { plans:Set, rates: { edad: { planId: tarifa } } }
  let rateRows = 0
  for (const r of parseCsv(rateCsv)) {
    const areaNum = parseInt(String(r.RatingAreaId || '').replace(/\D/g, ''), 10)
    if (!areaNum) continue
    const planId = (r.PlanId || '').trim()
    if (!plans.has(planId)) continue
    const rate = parseFloat(r.IndividualRate)
    if (!isFinite(rate) || rate <= 0) continue
    // Solo tarifas sin recargo por tabaco (la columna "Tobaco" trae "No Preference").
    const age = (r.Age || '').trim()
    if (!age) continue
    rateRows++
    if (!byArea.has(areaNum)) byArea.set(areaNum, { plans: new Set(), rates: {} })
    const a = byArea.get(areaNum)
    a.plans.add(planId)
    ;(a.rates[age] ||= {})[planId] = rate
  }
  console.log(`   ✔ ${rateRows} tarifas en ${byArea.size} áreas`)

  // ── Guardar una fila por área ─────────────────────────────────────────────
  console.log('\n   Guardando en la base de datos...')
  let saved = 0
  for (const [area, data] of [...byArea.entries()].sort((a, b) => a[0] - b[0])) {
    const areaPlans = [...data.plans].map(id => plans.get(id)).filter(Boolean)
    // Solo se guardan las áreas de servicio de los planes de esta área.
    const usedSa = {}
    for (const p of areaPlans) if (p.sa && serviceAreas[p.sa]) usedSa[p.sa] = serviceAreas[p.sa]
    const payload = JSON.stringify({ plans: areaPlans, rates: data.rates, serviceAreas: usedSa })
    await prisma.georgiaMarketData.upsert({
      where: { year_ratingArea: { year: YEAR, ratingArea: area } },
      update: { payload },
      create: { year: YEAR, ratingArea: area, payload },
    })
    saved++
    const silver = areaPlans.filter(p => p.metalLevel === 'Silver').length
    console.log(`   ✔ Área ${String(area).padStart(2)} — ${String(areaPlans.length).padStart(3)} planes (${silver} Silver) · ${(payload.length / 1024).toFixed(0)} KB`)
  }

  console.log(`\n✅ Listo: ${saved} áreas guardadas para ${YEAR}.`)
  console.log('   La Calculadora APTC ya cotiza Georgia automáticamente por ZIP.\n')
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
