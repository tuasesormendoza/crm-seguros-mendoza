import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  asuntoAviso,
  cuerpoAviso,
  etiquetaHogar,
  etiquetaIngreso,
  digitosTelefono,
} from './leadNotification.ts'

// ── Asunto ──────────────────────────────────────────────────────────────────

test('el asunto lleva nombre y telefono: en el movil suele ser lo unico visible', () => {
  const s = asuntoAviso({ fullName: 'Maria Gonzalez', phone: '305-555-0100' })
  assert.match(s, /Maria Gonzalez/)
  assert.match(s, /305-555-0100/)
})

test('el asunto funciona aunque no haya telefono', () => {
  const s = asuntoAviso({ fullName: 'Maria Gonzalez' })
  assert.match(s, /Maria Gonzalez/)
  assert.doesNotMatch(s, /·\s*$/)
})

// ── Etiquetas del quiz ──────────────────────────────────────────────────────

test('traduce los codigos del quiz a algo legible', () => {
  assert.equal(etiquetaHogar('3-4'), '3 a 4 personas')
  assert.equal(etiquetaIngreso('mid-low'), '$1,500 – $3,000/mes')
})

test('si el codigo no se reconoce se muestra tal cual, sin romperse', () => {
  assert.equal(etiquetaHogar('desconocido'), 'desconocido')
  assert.equal(etiquetaIngreso('otro'), 'otro')
})

test('sin valor no inventa etiqueta', () => {
  assert.equal(etiquetaHogar(null), null)
  assert.equal(etiquetaIngreso(undefined), null)
})

// ── Teléfono ────────────────────────────────────────────────────────────────

test('digitosTelefono limpia el formato para los enlaces', () => {
  assert.equal(digitosTelefono('(305) 555-0100'), '3055550100')
  assert.equal(digitosTelefono('+1 305.555.0100'), '13055550100')
  assert.equal(digitosTelefono(null), '')
})

// ── Cuerpo ──────────────────────────────────────────────────────────────────

test('el cuerpo incluye los datos del lead', () => {
  const html = cuerpoAviso({
    fullName: 'Maria Gonzalez',
    phone: '305-555-0100',
    email: 'maria@correo.com',
    householdSize: '3-4',
    income: 'mid-low',
    source: 'Web · Quiz',
  })
  assert.match(html, /Maria Gonzalez/)
  assert.match(html, /maria@correo\.com/)
  assert.match(html, /3 a 4 personas/)
  assert.match(html, /\$1,500 – \$3,000\/mes/)
  assert.match(html, /Web · Quiz/)
})

test('ofrece llamar y escribir por WhatsApp de un toque', () => {
  const html = cuerpoAviso({ fullName: 'Maria', phone: '(305) 555-0100' })
  assert.match(html, /href="tel:\+13055550100"/)
  assert.match(html, /href="https:\/\/wa\.me\/13055550100"/)
})

test('sin telefono no muestra botones rotos', () => {
  const html = cuerpoAviso({ fullName: 'Maria', email: 'maria@correo.com' })
  assert.doesNotMatch(html, /href="tel:/)
  assert.doesNotMatch(html, /wa\.me/)
})

test('avisa cuando el lead NO autorizo ser contactado', () => {
  const sin = cuerpoAviso({ fullName: 'Maria', phone: '3055550100', consentAt: null })
  assert.match(sin, /No marcó la casilla de autorización/)
  const con = cuerpoAviso({ fullName: 'Maria', phone: '3055550100', consentAt: new Date() })
  assert.match(con, /Autorizó ser contactado/)
  assert.doesNotMatch(con, /No marcó/)
})

test('no deja pasar HTML inyectado en los datos del lead', () => {
  const html = cuerpoAviso({
    fullName: '<script>alert(1)</script>',
    notes: '<img src=x onerror=alert(2)>',
  })
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;script&gt;/)
})

test('omite las filas sin dato en vez de dejarlas vacias', () => {
  const html = cuerpoAviso({ fullName: 'Maria', phone: '3055550100' })
  assert.doesNotMatch(html, /Ingreso/)
  assert.doesNotMatch(html, /Estado/)
  assert.match(html, /Teléfono/)
})
