import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateIntakeKey,
  looksLikeKey,
  originAllowed,
  validateIntake,
  isHoneypotTripped,
  normalizeIntake,
  rateLimited,
} from './publicIntake.ts'

// ── Claves ──────────────────────────────────────────────────────────────────

test('generateIntakeKey produce claves con el prefijo y longitud esperados', () => {
  const k = generateIntakeKey()
  assert.match(k, /^ak_[a-z0-9]{16,40}$/)
  assert.ok(looksLikeKey(k))
})

test('generateIntakeKey no repite claves', () => {
  const claves = new Set(Array.from({ length: 200 }, () => generateIntakeKey()))
  assert.equal(claves.size, 200)
})

test('looksLikeKey rechaza basura sin tocar la base de datos', () => {
  for (const malo of ['', 'ak_', 'nope', 'ak_MAYUSCULAS123456', null, undefined, 42, {}]) {
    assert.equal(looksLikeKey(malo), false, `deberia rechazar: ${String(malo)}`)
  }
})

// ── Orígenes permitidos ─────────────────────────────────────────────────────

test('originAllowed acepta el dominio configurado, con y sin www', () => {
  const permitidos = 'miagencia.com'
  assert.ok(originAllowed('https://miagencia.com', permitidos))
  assert.ok(originAllowed('https://www.miagencia.com', permitidos))
  assert.ok(originAllowed('http://miagencia.com:443', permitidos))
})

test('originAllowed rechaza otros dominios', () => {
  const permitidos = 'miagencia.com'
  assert.equal(originAllowed('https://otraagencia.com', permitidos), false)
  // Un subdominio no listado no debe colarse
  assert.equal(originAllowed('https://malo.miagencia.com.attacker.io', permitidos), false)
  // Prefijo parecido pero distinto
  assert.equal(originAllowed('https://miagencia.com.evil.com', permitidos), false)
})

test('originAllowed deniega si la agencia no configuro dominios', () => {
  assert.equal(originAllowed('https://miagencia.com', null), false)
  assert.equal(originAllowed('https://miagencia.com', '   '), false)
})

test('originAllowed deniega si la peticion no trae origen', () => {
  assert.equal(originAllowed(null, 'miagencia.com'), false)
})

test('originAllowed admite varios dominios separados por comas', () => {
  const permitidos = 'miagencia.com, otraweb.net'
  assert.ok(originAllowed('https://otraweb.net', permitidos))
  assert.ok(originAllowed('https://www.miagencia.com', permitidos))
  assert.equal(originAllowed('https://tercera.org', permitidos), false)
})

// ── Validación ──────────────────────────────────────────────────────────────

test('validateIntake acepta un lead con nombre y telefono', () => {
  assert.deepEqual(validateIntake({ fullName: 'Maria Gonzalez', phone: '305-555-0100' }), {})
})

test('validateIntake acepta un lead con nombre y email', () => {
  assert.deepEqual(validateIntake({ fullName: 'Maria', email: 'maria@correo.com' }), {})
})

test('validateIntake exige nombre', () => {
  assert.ok(validateIntake({ phone: '3055550100' }).fullName)
  assert.ok(validateIntake({ fullName: '   ', phone: '3055550100' }).fullName)
  assert.ok(validateIntake({ fullName: 'A', phone: '3055550100' }).fullName)
})

test('validateIntake exige alguna forma de contacto', () => {
  assert.ok(validateIntake({ fullName: 'Maria Gonzalez' }).contact)
})

test('validateIntake rechaza formatos invalidos', () => {
  assert.ok(validateIntake({ fullName: 'Maria', phone: 'abc' }).phone)
  assert.ok(validateIntake({ fullName: 'Maria', email: 'no-es-un-email' }).email)
})

// ── Campo trampa ────────────────────────────────────────────────────────────

test('isHoneypotTripped detecta bots que rellenan el campo oculto', () => {
  assert.ok(isHoneypotTripped({ company: 'Acme SEO' }))
  assert.equal(isHoneypotTripped({ company: '' }), false)
  assert.equal(isHoneypotTripped({}), false)
})

// ── Normalización ───────────────────────────────────────────────────────────

test('normalizeIntake mapea las respuestas del quiz a los campos del prospecto', () => {
  const r = normalizeIntake({
    fullName: '  Maria Gonzalez  ',
    phone: ' 305-555-0100 ',
    householdSize: '3-4',
    income: 'mid-low',
    situation: 'Sin seguro actualmente',
    sourceDetail: 'Quiz',
  })
  assert.equal(r.fullName, 'Maria Gonzalez')
  assert.equal(r.phone, '305-555-0100')
  assert.equal(r.householdSize, '3-4')
  assert.equal(r.income, 'mid-low')
  assert.equal(r.source, 'Web · Quiz')
  assert.match(r.notes as string, /Sin seguro actualmente/)
})

test('normalizeIntake solo registra consentimiento cuando llega true explicito', () => {
  const ahora = new Date('2026-08-06T12:00:00Z')
  assert.equal(normalizeIntake({ fullName: 'Maria', phone: '3055550100' }, ahora).consentAt, null)
  assert.equal(normalizeIntake({ fullName: 'Maria', phone: '3055550100', consent: 'si' }, ahora).consentAt, null)
  assert.deepEqual(normalizeIntake({ fullName: 'Maria', phone: '3055550100', consent: true }, ahora).consentAt, ahora)
})

test('normalizeIntake recorta textos desmesurados', () => {
  const r = normalizeIntake({ fullName: 'x'.repeat(500), phone: '3055550100', notes: 'y'.repeat(5000) })
  assert.equal(r.fullName.length, 200)
  assert.equal((r.notes as string).length, 2000)
})

test('normalizeIntake ignora campos que no reconoce', () => {
  const r = normalizeIntake({ fullName: 'Maria', phone: '3055550100', stage: 'Cerrado - Ganado' } as never)
  assert.equal((r as unknown as Record<string, unknown>).stage, undefined)
})

// ── Límite de peticiones ────────────────────────────────────────────────────

test('rateLimited deja pasar el trafico normal y frena las rafagas', () => {
  const store = new Map<string, number[]>()
  const t = 1_000_000
  for (let i = 0; i < 10; i++) {
    assert.equal(rateLimited('1.2.3.4', t + i, 10, 60_000, store), false, `peticion ${i + 1}`)
  }
  assert.equal(rateLimited('1.2.3.4', t + 11, 10, 60_000, store), true)
})

test('rateLimited cuenta cada IP por separado', () => {
  const store = new Map<string, number[]>()
  const t = 1_000_000
  for (let i = 0; i < 11; i++) rateLimited('1.1.1.1', t + i, 10, 60_000, store)
  assert.equal(rateLimited('2.2.2.2', t + 12, 10, 60_000, store), false)
})

test('rateLimited olvida los golpes fuera de la ventana', () => {
  const store = new Map<string, number[]>()
  const t = 1_000_000
  for (let i = 0; i < 11; i++) rateLimited('1.1.1.1', t + i, 10, 60_000, store)
  assert.equal(rateLimited('1.1.1.1', t + 61_000, 10, 60_000, store), false)
})
