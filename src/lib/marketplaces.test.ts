// Pruebas de la detección de mercados estatales y expansión de Medicaid.
// Estas decisiones cambian lo que se le dice al cliente sobre su elegibilidad,
// así que se verifican explícitamente.

import { test } from 'node:test'
import assert from 'node:assert'
import { stateCode, getStateMarketplace, isMedicaidExpansionState } from './marketplaces.ts'

test('stateCode normaliza códigos y nombres completos', () => {
  assert.strictEqual(stateCode('GA'), 'GA')
  assert.strictEqual(stateCode('ga'), 'GA')
  assert.strictEqual(stateCode('Georgia'), 'GA')
  assert.strictEqual(stateCode('georgia'), 'GA')
  assert.strictEqual(stateCode('New York'), 'NY')
  assert.strictEqual(stateCode('Florida'), 'FL')
  assert.strictEqual(stateCode(''), '')
  assert.strictEqual(stateCode(null), '')
})

test('Georgia usa su propio mercado (Georgia Access)', () => {
  for (const s of ['GA', 'ga', 'Georgia']) {
    const m = getStateMarketplace(s)
    assert.ok(m, `${s} debe tener mercado propio`)
    assert.strictEqual(m!.name, 'Georgia Access')
    assert.strictEqual(m!.url, 'https://georgiaaccess.gov')
  }
})

test('Florida y Texas usan el Mercado federal (sin mercado propio)', () => {
  assert.strictEqual(getStateMarketplace('FL'), null)
  assert.strictEqual(getStateMarketplace('Florida'), null)
  assert.strictEqual(getStateMarketplace('TX'), null)
  assert.strictEqual(getStateMarketplace(''), null)
})

test('otros estados con mercado propio también se detectan', () => {
  assert.strictEqual(getStateMarketplace('CA')?.name, 'Covered California')
  assert.strictEqual(getStateMarketplace('NY')?.name, 'NY State of Health')
  assert.strictEqual(getStateMarketplace('PA')?.name, 'Pennie')
})

test('Medicaid: Georgia y Florida NO expandieron (hay brecha de cobertura)', () => {
  assert.ok(!isMedicaidExpansionState('GA'))
  assert.ok(!isMedicaidExpansionState('Georgia'))
  assert.ok(!isMedicaidExpansionState('FL'))
  assert.ok(!isMedicaidExpansionState('TX'))
})

test('Medicaid: estados que sí expandieron', () => {
  assert.ok(isMedicaidExpansionState('NY'))
  assert.ok(isMedicaidExpansionState('CA'))
  // Sin dato de estado se asume expansión (no se afirma una brecha sin saberlo).
  assert.ok(isMedicaidExpansionState(''))
  assert.ok(isMedicaidExpansionState(null))
})
