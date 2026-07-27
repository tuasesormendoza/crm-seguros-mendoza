// Pruebas de la regla de elegibilidad del subsidio (APTC) desde el 01/01/2027.
// Es una regla de NEGOCIO que dispara avisos al agente y a sus clientes, así que
// se verifica el antes/después de la fecha y cada categoría de estatus.

import { test } from 'node:test'
import assert from 'node:assert'
import { checkSubsidy, daysUntilRule, SUBSIDY_RULE_DATE } from './subsidyEligibility.ts'

const ANTES = new Date(2026, 6, 27)   // 27 jul 2026
const DESPUES = new Date(2027, 0, 15) // 15 ene 2027

test('ciudadanos y residentes permanentes conservan el subsidio', () => {
  for (const s of ['Ciudadano/a americano/a', 'Residente permanente (Green Card)']) {
    for (const when of [ANTES, DESPUES]) {
      const r = checkSubsidy(s, when)
      assert.ok(r.keepsSubsidy, `${s} debe conservar el subsidio`)
      assert.ok(!r.losesSubsidy)
      assert.ok(!r.unknown)
    }
  }
})

test('los demás estatus PIERDEN el subsidio por la regla de 2027', () => {
  const afectados = ['Asilo político', 'Refugiado/a', 'TPS (Estatus de Protección Temporal)',
    'Parole humanitario', 'Visa U', 'Permiso de trabajo (EAD)', 'DACA', 'Sin estatus / Indocumentado/a']
  for (const s of afectados) {
    const r = checkSubsidy(s, ANTES)
    assert.ok(r.losesSubsidy, `${s} debe quedar marcado como que pierde el subsidio`)
    assert.ok(!r.keepsSubsidy)
    assert.ok(!r.unknown)
  }
})

test('el mensaje cambia según si la regla ya está vigente', () => {
  const antes = checkSubsidy('TPS (Estatus de Protección Temporal)', ANTES)
  assert.ok(!antes.ruleActive)
  assert.match(antes.message, /01\/01\/2027/)

  const despues = checkSubsidy('TPS (Estatus de Protección Temporal)', DESPUES)
  assert.ok(despues.ruleActive)
  assert.match(despues.message, /precio completo/)
})

test('sin estatus registrado queda como DESCONOCIDO (hay que preguntarle)', () => {
  for (const s of [null, undefined, '', '   ', 'Otro', 'Prefiere no responder']) {
    const r = checkSubsidy(s as string | null | undefined, ANTES)
    assert.ok(r.unknown, `"${s}" debe quedar como desconocido`)
    assert.ok(!r.keepsSubsidy)
    assert.ok(!r.losesSubsidy, 'no se debe afirmar que pierde el subsidio sin saber su estatus')
  }
})

test('la regla entra en vigor exactamente el 1 de enero de 2027', () => {
  const finDe2026 = new Date(2026, 11, 31, 23, 59)
  assert.ok(!checkSubsidy('DACA', finDe2026).ruleActive)
  assert.ok(checkSubsidy('DACA', SUBSIDY_RULE_DATE).ruleActive)
})

test('daysUntilRule cuenta hacia la fecha y llega a 0 cuando ya pasó', () => {
  assert.ok(daysUntilRule(new Date(2026, 11, 1)) > 0)
  assert.strictEqual(daysUntilRule(new Date(2027, 0, 1)), 0)
  assert.strictEqual(daysUntilRule(new Date(2027, 5, 1)), 0)
})
