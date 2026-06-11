import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extractStatementRows, type PdfItem } from './pdfStatement.ts'

// Items sintéticos que imitan el layout real de un estado de cuenta de Oscar:
// encabezado con columnas Company/Insured/Payment/Effective Date y filas de datos,
// incluyendo un nombre partido en 2 líneas ("MARY VIVAS" + "PAR").
function buildItems(): PdfItem[] {
  const items: PdfItem[] = []
  const add = (y: number, cells: [number, string][]) => {
    for (const [x, str] of cells) items.push({ page: 1, x, y, str })
  }
  // Encabezado (y alto = arriba)
  add(700, [[38, 'Company'], [270, 'Insured'], [322, 'Account'], [520, 'Payment'], [568, 'Effective Date']])
  // Filas de datos
  add(680, [[38, 'OSCAR'], [270, 'ALEXANDER'], [322, 'OSC04855334-0'], [520, '$25.00'], [568, '1/1/2026']])
  add(672, [[270, 'CHAC'], [322, '1']]) // continuación del nombre
  add(660, [[38, 'OSCAR'], [270, 'EDWARD FILPO'], [322, 'OSC75347518-0'], [520, '$100.00'], [568, '1/1/2026']])
  add(640, [[38, 'OSCAR'], [270, 'MARY VIVAS'], [322, 'OSC03675097-0'], [520, '$25.00'], [568, '1/1/2026']])
  add(632, [[270, 'PAR'], [322, '1']]) // continuación del nombre
  // Total
  add(600, [[46, 'Total Payment:'], [156, '$150.00']])
  return items
}

describe('extractStatementRows', () => {
  const res = extractStatementRows(buildItems())

  test('detecta aseguradora y periodo', () => {
    assert.equal(res.insurer, 'OSCAR')
    assert.equal(res.period, '2026-01')
  })
  test('extrae 3 clientes con sus montos', () => {
    assert.equal(res.rows.length, 3)
    assert.deepEqual(res.rows[0], { name: 'ALEXANDER CHAC', amount: 25 })
    assert.deepEqual(res.rows[1], { name: 'EDWARD FILPO', amount: 100 })
    assert.deepEqual(res.rows[2], { name: 'MARY VIVAS PAR', amount: 25 })
  })
  test('captura el total reportado', () => {
    assert.equal(res.totalPayment, 150)
  })
  test('sin encabezado reconocible → resultado vacío', () => {
    const res2 = extractStatementRows([{ page: 1, x: 10, y: 10, str: 'cualquier cosa' }])
    assert.equal(res2.rows.length, 0)
  })
})
