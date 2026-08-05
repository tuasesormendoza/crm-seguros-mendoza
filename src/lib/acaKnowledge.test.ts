// El asistente le repite este texto al agente, que a su vez se lo repite al
// cliente. Si se desincroniza de lo que el CRM calcula de verdad, el agente
// dice un número delante del cliente y la Calculadora APTC le contradice.
// Estas pruebas atan el texto al cálculo real.

import { test } from 'node:test'
import assert from 'node:assert'
import { ACA_KNOWLEDGE } from './acaKnowledge.ts'
import { applicablePercentage, hasSubsidyCliff, usesEnhancedSubsidies } from './aptcSchedule.ts'
import { isMedicaidExpansionState } from './marketplaces.ts'

test('NO afirma las reglas de subsidio que expiraron el 01/01/2026', () => {
  // El documento del que salió este texto decía "nadie paga más del 8.5%" y
  // "se eliminó el límite del 400%". Eso caducó y es el error que hacía que el
  // CRM diera $55/mes de más. Puede MENCIONARSE para desmentirlo, pero nunca
  // afirmarse: por eso se exige que aparezca junto al aviso de que ya no aplica.
  assert.ok(ACA_KNOWLEDGE.includes('EXPIRARON'), 'debe avisar de que los subsidios mejorados expiraron')
  assert.ok(ACA_KNOWLEDGE.includes('YA NO APLICA'), 'debe marcar explícitamente esa información como caducada')
  assert.ok(ACA_KNOWLEDGE.includes('precipicio del 400%'), 'debe explicar que volvió el precipicio del 400%')
})

test('los porcentajes citados coinciden con la tabla real del IRS', () => {
  // 2.1% por debajo del 133% del FPL, 9.96% entre 300% y 400%.
  assert.strictEqual(applicablePercentage(120, 2026), 2.10)
  assert.strictEqual(applicablePercentage(350, 2026), 9.96)
  assert.ok(ACA_KNOWLEDGE.includes('2.1%'), 'el texto cita 2.1%')
  assert.ok(ACA_KNOWLEDGE.includes('9.96%'), 'el texto cita 9.96%')
})

test('el precipicio del 400% que describe el texto es el que aplica el cálculo', () => {
  assert.strictEqual(hasSubsidyCliff(2026), true)
  assert.strictEqual(applicablePercentage(401, 2026), null, 'sobre el 400% no hay crédito')
  assert.strictEqual(usesEnhancedSubsidies(2025), true, 'en 2025 sí aplicaban los mejorados')
})

test('los estados sin expansión de Medicaid que lista el texto son los correctos', () => {
  // Si esta lista miente, el agente le dice a alguien de Georgia que pasará a
  // Medicaid cuando en realidad cae en la brecha de cobertura.
  const citados: [string, string][] = [
    ['Georgia', 'GA'], ['Florida', 'FL'], ['Texas', 'TX'], ['Alabama', 'AL'],
    ['Misisipi', 'MS'], ['Carolina del Sur', 'SC'], ['Tennessee', 'TN'],
    ['Kansas', 'KS'], ['Wisconsin', 'WI'], ['Wyoming', 'WY'],
  ]
  for (const [nombre, code] of citados) {
    assert.ok(ACA_KNOWLEDGE.includes(nombre), `el texto debe listar ${nombre}`)
    assert.strictEqual(isMedicaidExpansionState(code), false, `${code} NO expandió Medicaid`)
  }
  // Y no debe colar un estado que sí expandió.
  for (const code of ['CA', 'NY', 'PA', 'NV']) {
    assert.strictEqual(isMedicaidExpansionState(code), true)
  }
})

test('explica la brecha de cobertura en vez del mito de "pasas a Medicaid"', () => {
  assert.ok(ACA_KNOWLEDGE.includes('BRECHA DE COBERTURA'))
  assert.ok(ACA_KNOWLEDGE.includes('Es FALSO'), 'debe desmentir el error explícitamente')
})

test('no inventa cifras del FPL en dólares: manda a la calculadora', () => {
  // Los valores del FPL se configuran en el CRM y cambian cada enero. Si el
  // texto trae cifras fijas, tarde o temprano contradicen a la calculadora.
  assert.ok(!/\$1[0-9],[0-9]{3}/.test(ACA_KNOWLEDGE), 'no debe traer cifras de FPL escritas a mano')
  assert.ok(ACA_KNOWLEDGE.includes('Calculadora APTC'))
})

test('recoge la regla migratoria del 01/01/2027', () => {
  assert.ok(ACA_KNOWLEDGE.includes('01/01/2027'))
})
