// ─────────────────────────────────────────────────────────────────────────────
// GUARDIÁN MULTI-TENANT — prueba de análisis estático.
//
// Este CRM es multi-agencia (SaaS): TODA consulta a la base de datos en una
// ruta API debe estar aislada por `agencyId`. Esta prueba recorre el AST de
// cada src/app/api/**/route.ts y falla el build si:
//
//   1. Una ruta no invoca un helper de autenticación (getAuth / requireRole /
//      requireAdmin / getSession), salvo las rutas públicas del allowlist.
//   2. Una llamada `prisma.<modelo>.<método>(...)` no incluye `agencyId` en
//      sus argumentos, salvo los patrones seguros documentados abajo.
//
// Si agregas una ruta o consulta nueva y esta prueba falla: lo correcto casi
// siempre es agregar el filtro por agencyId, NO agregar una exención. Solo
// agrega una exención si puedes explicar por qué la consulta no puede filtrar
// datos de otra agencia.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api')

// ── Rutas públicas por diseño (no requieren sesión) ──────────────────────────
const PUBLIC_ROUTES = new Set([
  'ping/route.ts',           // health-check del keep-alive
  'auth/route.ts',           // login/logout — crea la sesión
  'theme/route.ts',          // colores del login (sin PII)
  'survey/route.ts',         // encuesta pública de satisfacción (link enviado al cliente)
  'logo/[agencyId]/route.ts', // logo público para emails (solo bytes de imagen)
  'google/sync-cron/route.ts', // cron de sync Google→CRM; protegido por clave derivada del SESSION_SECRET
  'google/backup-cron/route.ts', // cron de respaldo a Drive; protegido por clave derivada del SESSION_SECRET
  'campaigns/track/[id]/route.ts', // pixel de apertura (público, lo carga el email del cliente)
  'campaigns/cron/route.ts',       // cron de campañas programadas/automáticas; protegido por cronKey
  'public/leads/route.ts',         // entrada de leads desde la web pública de la agencia; enruta por publicIntakeKey, restringe por origen y SOLO escribe
])

// ── Modelos sin inquilino (no llevan agencyId en el schema) ──────────────────
const TENANTLESS_MODELS = new Set([
  'loginAttempt', // keyed por identifier (email/IP) — es pre-autenticación
  'agency',       // el propio registro del inquilino
  // Tarifas y planes PÚBLICOS del mercado de Georgia (importados de los archivos
  // oficiales del estado). No pertenecen a ninguna agencia: son los mismos datos
  // para todas, igual que los precios que devuelve la API federal de CMS.
  'georgiaMarketData',
])

// ── Exenciones puntuales: "ruta :: modelo.método" → razón ────────────────────
// Cada entrada debe explicar por qué la consulta es segura sin agencyId.
// El patrón más común es "verificar-luego-actuar": la ruta primero confirma la
// pertenencia con findFirst/updateMany filtrado por agencyId (404 si no), y
// después actúa sobre el id ya verificado.
const EXEMPTIONS = new Map<string, string>([
  ['survey/route.ts :: client.findUnique',
    'Ruta pública por diseño: expone solo el primer nombre para saludar en la encuesta; el clientId actúa como token del link.'],
  ['survey/route.ts :: surveyResponse.create',
    'Ruta pública: hereda el agencyId del cliente consultado (client.agencyId), no del usuario.'],
  ['survey/route.ts :: surveyResponse.findFirst',
    'Ruta pública: chequeo anti-spam (1 respuesta/24h) por clientId, que actúa como token del link; solo devuelve existencia.'],
  ['settings/change-password/route.ts :: user.findUnique',
    'Busca por email de LA SESIÓN actual (único global) — el usuario solo puede cambiar su propia contraseña.'],
  ['settings/change-password/route.ts :: user.update',
    'Actualiza por email de la sesión actual — solo su propia cuenta.'],
  ['auth/route.ts :: user.findUnique',
    'Flujo de login (pre-autenticación): busca por email para verificar credenciales.'],
  ['auth/route.ts :: user.update',
    'Flujo de login: actualiza lastLogin del usuario que acaba de autenticarse.'],
  ['prospects/[id]/route.ts :: prospect.findUnique',
    'Re-lectura tras updateMany filtrado por agencyId (count===0 → 404).'],
  ['commission-payments/[id]/route.ts :: commissionPayment.update',
    'Verificar-luego-actuar: findFirst({id, agencyId}) + 404 justo antes del update.'],
  ['documents/[docId]/route.ts :: document.delete',
    'Verificar-luego-actuar: findFirst({id, agencyId}) + 404 justo antes del delete.'],
  ['clients/[id]/insurer-history/route.ts :: insurerHistory.update',
    'El entry.id proviene de un findMany ya filtrado por {clientId, agencyId}.'],
  ['clients/[id]/insurer-history/route.ts :: client.update',
    'Verificar-luego-actuar: client.findFirst({id, agencyId}) + 404 arriba en la misma función.'],
  ['users/[userId]/route.ts :: user.update',
    'Verificar-luego-actuar: user.findFirst({id, agencyId}) + 404 al inicio del PUT.'],
  ['users/[userId]/route.ts :: user.delete',
    'Verificar-luego-actuar: user.findFirst({id, agencyId}) + 404 al inicio del DELETE.'],
  ['users/route.ts :: user.findUnique',
    'Chequeo de unicidad GLOBAL de email antes de crear (email es @unique en todo el sistema); solo revela "email ocupado".'],
  ['campaigns/track/[id]/route.ts :: campaign.updateMany',
    'Pixel público de apertura: solo incrementa openCount por id de campaña (cuid no adivinable); no lee ni expone datos, no cruza agencias.'],
  // ── Verificación en dos pasos: siempre sobre la PROPIA cuenta del usuario ──
  ['auth/2fa/setup/route.ts :: user.update',
    'Guarda el secreto TOTP del PROPIO usuario (id tomado de su sesión o del paso intermedio del login); nunca de otra cuenta.'],
  ['auth/2fa/activate/route.ts :: user.findUnique',
    'Lee la PROPIA cuenta por el id de la sesión para activar su 2FA.'],
  ['auth/2fa/activate/route.ts :: user.update',
    'Activa el 2FA de la PROPIA cuenta (id de la sesión o del paso intermedio del login).'],
  ['auth/2fa/status/route.ts :: user.findUnique',
    'Devuelve el estado de 2FA de la PROPIA cuenta (auth.userId); no expone datos de otros.'],
  ['users/[userId]/reset-2fa/route.ts :: user.update',
    'Verificar-luego-actuar: user.findFirst({id, agencyId}) + 404 justo antes; solo un admin reinicia el 2FA de SU agencia.'],
])

// ── Recolectar archivos route.ts ──────────────────────────────────────────────
function collectRoutes(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectRoutes(full))
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

const routeFiles = collectRoutes(API_DIR)
const rel = (f: string) => path.relative(API_DIR, f)

// ── Extraer llamadas prisma.<modelo>.<método>(args) del AST ─────────────────
interface PrismaCall { model: string; method: string; argsText: string; line: number }

function extractPrismaCalls(file: string): PrismaCall[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const calls: PrismaCall[] = []
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      ts.isIdentifier(node.expression.expression.expression) &&
      node.expression.expression.expression.text === 'prisma'
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      calls.push({
        model: node.expression.expression.name.text,
        method: node.expression.name.text,
        argsText: node.arguments.map(a => a.getText()).join(', '),
        line: line + 1,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return calls
}

// ── Prueba 1: toda ruta no-pública exige autenticación ───────────────────────
test('toda ruta API no-pública invoca un helper de autenticación', () => {
  const AUTH_RE = /\b(getAuth|requireRole|requireAdmin|getSession)\s*\(/
  const missing: string[] = []
  for (const file of routeFiles) {
    const relPath = rel(file)
    if (PUBLIC_ROUTES.has(relPath)) continue
    if (!AUTH_RE.test(readFileSync(file, 'utf8'))) missing.push(relPath)
  }
  assert.deepStrictEqual(missing, [],
    `Rutas SIN autenticación (agrega getAuth() o, si es pública a propósito, documéntala en PUBLIC_ROUTES):\n  ${missing.join('\n  ')}`)
})

// ── Prueba 2: rutas públicas siguen existiendo (allowlist no está podrida) ───
test('el allowlist de rutas públicas no contiene entradas muertas', () => {
  const existing = new Set(routeFiles.map(rel))
  const dead = [...PUBLIC_ROUTES].filter(p => !existing.has(p))
  assert.deepStrictEqual(dead, [], `Entradas de PUBLIC_ROUTES que ya no existen: ${dead.join(', ')}`)
})

// ── Prueba 3: toda consulta prisma en rutas API filtra por agencyId ──────────
test('toda consulta prisma en rutas API está aislada por agencyId', () => {
  const violations: string[] = []

  for (const file of routeFiles) {
    const relPath = rel(file)
    const text = readFileSync(file, 'utf8')
    const fileHasClientGuard = /clientInAgency\s*\(/.test(text)
    // Variable `where` construida en el archivo con agencyId dentro de sus
    // primeras líneas (patrón: const where = { agencyId: auth.agencyId, ... }),
    // o asignada desde un helper que recibe el agencyId como primer argumento
    // (ej. const where = buildSegmentWhere(auth.agencyId, ...)).
    const fileHasScopedWhereVar =
      /const where[^=]*=\s*\{[\s\S]{0,400}?\bagencyId\b/.test(text) ||
      /const where[^=]*=\s*\w+\(\s*(auth\.)?agencyId\b/.test(text)

    for (const call of extractPrismaCalls(file)) {
      const key = `${relPath} :: ${call.model}.${call.method}`

      if (TENANTLESS_MODELS.has(call.model)) continue
      if (EXEMPTIONS.has(key)) continue
      // El filtro está en los argumentos de la llamada
      if (/\bagencyId\b/.test(call.argsText)) continue
      // La llamada usa la variable `where` que sí contiene agencyId
      if (fileHasScopedWhereVar && /(^|\W)where\s*[,})]/.test(call.argsText)) continue
      // Patrón sub-recurso: la ruta verificó la pertenencia del cliente con
      // clientInAgency(clientId, auth.agencyId) y luego consulta por clientId
      // o actualiza el propio cliente por id.
      if (fileHasClientGuard && /\bclientId\b/.test(call.argsText)) continue
      if (fileHasClientGuard && /where:\s*\{\s*id\s*[,}]/.test(call.argsText)) continue

      violations.push(`${key} (línea ${call.line})`)
    }
  }

  assert.deepStrictEqual(violations, [],
    `Consultas prisma SIN aislamiento por agencyId — riesgo de fuga entre agencias:\n  ${violations.join('\n  ')}\n` +
    `Agrega el filtro agencyId, o si el patrón es seguro, documenta una exención en EXEMPTIONS con su razón.`)
})

// ── Prueba 4: las exenciones no están podridas ────────────────────────────────
test('toda exención corresponde a una llamada que aún existe', () => {
  const liveKeys = new Set<string>()
  for (const file of routeFiles) {
    for (const call of extractPrismaCalls(file)) {
      liveKeys.add(`${rel(file)} :: ${call.model}.${call.method}`)
    }
  }
  const dead = [...EXEMPTIONS.keys()].filter(k => !liveKeys.has(k))
  assert.deepStrictEqual(dead, [], `Exenciones muertas (la llamada ya no existe — elimínalas):\n  ${dead.join('\n  ')}`)
})

// ── Prueba 5: las rutas públicas atraviesan el middleware ───────────────────
// Una ruta puede estar bien escrita y aun así no funcionar nunca: el middleware
// global bloquea todo /api/ salvo lo que aparece en su lista blanca. Si las dos
// listas se desincronizan, la ruta responde 401 sin llegar a ejecutarse.
test('toda ruta pública de API está permitida en el middleware', () => {
  const mw = readFileSync(path.join(process.cwd(), 'src/middleware.ts'), 'utf8')
  const lista = mw.match(/const PUBLIC_PATHS\s*=\s*\[([^\]]*)\]/)
  assert.ok(lista, 'no se encontró PUBLIC_PATHS en src/middleware.ts')
  const permitidos = [...lista[1].matchAll(/'([^']+)'/g)].map(m => m[1])

  const bloqueadas = [...PUBLIC_ROUTES]
    .map(r => '/api/' + r.replace(/\/route\.ts$/, ''))
    .filter(ruta => !permitidos.some(p => ruta.startsWith(p)))

  assert.deepStrictEqual(bloqueadas, [],
    `Rutas declaradas públicas que el middleware bloquearía con 401:\n  ${bloqueadas.join('\n  ')}\n` +
    `Agrégalas a PUBLIC_PATHS en src/middleware.ts`)
})
