// Pruebas de la tabla de porcentaje aplicable (IRS).
// De aquí sale cuánto paga el cliente y cuánto es el subsidio, así que se
// verifica contra valores REALES del mercado, no contra nuestra propia salida.

import { test } from 'node:test'
import assert from 'node:assert'
import {
  applicablePercentage, expectedMonthlyContribution,
  usesEnhancedSubsidies, hasSubsidyCliff,
} from './aptcSchedule.ts'

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

test('CASO REAL de Georgia Access: $25,000 · 159.7% FPL · 2026 → $97/mes', () => {
  // Georgia Access mostró: SLCSP $979, crédito $882, cliente paga ~$97.
  const pct = applicablePercentage(159.7, 2026)
  assert.ok(pct !== null)
  assert.strictEqual(round(pct!), 4.66)               // 4.19 + (9.7/50)×2.41
  const pago = expectedMonthlyContribution(25000, 159.7, 2026)
  assert.strictEqual(round(pago!), 97.03)             // coincide con el mercado
})

test('los subsidios MEJORADOS expiraron: 2025 sí, 2026 no', () => {
  assert.ok(usesEnhancedSubsidies(2025))
  assert.ok(!usesEnhancedSubsidies(2026))
  assert.ok(!usesEnhancedSubsidies(2027))
  // Con ARPA, ese mismo cliente pagaba mucho menos.
  assert.strictEqual(round(applicablePercentage(159.7, 2025)!), 0.39)
})

test('el porcentaje sube GRADUALMENTE dentro del tramo (escala móvil)', () => {
  // Tramo 150–200%: de 4.19% a 6.60%.
  assert.strictEqual(round(applicablePercentage(150, 2026)!), 4.19)
  assert.strictEqual(round(applicablePercentage(175, 2026)!), 5.40)  // punto medio
  assert.strictEqual(round(applicablePercentage(199.9, 2026)!), 6.60)
  // Si fuera un valor fijo por tramo, 150 y 199 darían lo mismo — no debe ser así.
  assert.notStrictEqual(applicablePercentage(150, 2026), applicablePercentage(199, 2026))
})

test('tramos de la tabla 2026 en sus límites', () => {
  assert.strictEqual(round(applicablePercentage(100, 2026)!), 2.10)
  assert.strictEqual(round(applicablePercentage(132, 2026)!), 2.10)   // plano bajo 133%
  assert.strictEqual(round(applicablePercentage(133, 2026)!), 3.14)
  assert.strictEqual(round(applicablePercentage(200, 2026)!), 6.60)
  assert.strictEqual(round(applicablePercentage(250, 2026)!), 8.44)
  assert.strictEqual(round(applicablePercentage(300, 2026)!), 9.96)
  assert.strictEqual(round(applicablePercentage(399, 2026)!), 9.96)   // plano 300–400%
})

test('vuelve el PRECIPICIO del 400% del FPL en 2026 (sin subsidio)', () => {
  assert.ok(hasSubsidyCliff(2026))
  assert.strictEqual(applicablePercentage(400, 2026), null)
  assert.strictEqual(applicablePercentage(450, 2026), null)
  assert.strictEqual(expectedMonthlyContribution(80000, 450, 2026), null)
  // En 2025 (con ARPA) no había precipicio: se topaba en 8.5%.
  assert.ok(!hasSubsidyCliff(2025))
  assert.strictEqual(round(applicablePercentage(450, 2025)!), 8.5)
})

test('el aporte mensual se calcula sobre el ingreso anual', () => {
  // 300% FPL → 9.96% de $50,000 / 12
  assert.strictEqual(round(expectedMonthlyContribution(50000, 300, 2026)!), 415)
})
