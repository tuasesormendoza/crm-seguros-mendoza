// Pruebas de la lógica de comisiones. Se corren con el corredor integrado de
// Node (sin dependencias): `npm test`.
//
// Cubren el "deber ser" de pagos, el N de meses configurable por aseguradora,
// y — lo más delicado — la atribución correcta cuando un cliente CAMBIA de
// aseguradora a mitad de póliza (el caso real de Mary Vivas: Oscar dic–feb,
// Ambetter desde marzo).

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  getActivationDate,
  buildStints,
  stintCovers,
  getStintFirstPaymentDate,
  normalizeMonthDate,
  monthsBetween,
  wnCommission,
} from './commissions.ts'

// Helpers para fechas legibles
const d = (iso: string) => new Date(iso)
const ymd = (date: Date | null) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null
// Período (1ro del mes) a partir de "YYYY-MM"
const period = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1) }

describe('getActivationDate — activación = 1ro del mes siguiente', () => {
  test('contrata 06/15 → activa 07/01', () => {
    assert.equal(ymd(getActivationDate(d('2026-06-15'))), '2026-07-01')
  })
  test('contrata el último día del mes → activa el 1ro del siguiente', () => {
    assert.equal(ymd(getActivationDate(d('2026-12-31'))), '2027-01-01')
  })
  test('sin fecha de contrato → null', () => {
    assert.equal(getActivationDate(null), null)
  })
})

describe('getStintFirstPaymentDate — N meses configurable por aseguradora', () => {
  const stint = { insurer: 'Oscar', startDate: new Date(2026, 6, 1), endDate: null } // 2026-07-01

  test('por defecto (N=2): activa 07/01 → primera comisión 09/01', () => {
    assert.equal(ymd(getStintFirstPaymentDate(stint, {})), '2026-09-01')
  })
  test('Oscar configurado a N=1 → primera comisión 08/01', () => {
    assert.equal(ymd(getStintFirstPaymentDate(stint, { Oscar: 1 })), '2026-08-01')
  })
  test('N=3 cruzando fin de año', () => {
    const s = { insurer: 'X', startDate: new Date(2026, 10, 1), endDate: null } // 2026-11-01
    assert.equal(ymd(getStintFirstPaymentDate(s, { X: 3 })), '2027-02-01')
  })
})

describe('buildStints — sin historial de cambios', () => {
  test('un solo tramo desde la activación hasta "actual"', () => {
    const stints = buildStints('Oscar', d('2026-06-15'), [])
    assert.equal(stints.length, 1)
    assert.equal(stints[0].insurer, 'Oscar')
    assert.equal(ymd(stints[0].startDate), '2026-07-01')
    assert.equal(stints[0].endDate, null)
  })
  test('sin fecha de contrato y sin historial → sin tramos', () => {
    assert.deepEqual(buildStints('Oscar', null, []), [])
  })
})

describe('buildStints — cambio de aseguradora (caso Mary Vivas)', () => {
  // Mary tuvo Oscar de diciembre 2025 a febrero 2026, y se cambió a Ambetter
  // desde marzo 2026 (aseguradora actual del cliente).
  const history = [{ insurer: 'Oscar', startDate: period('2025-12'), endDate: period('2026-02') }]
  const stints = buildStints('Ambetter', d('2025-11-15'), history)

  test('genera 2 tramos: Oscar (cerrado) y Ambetter (actual)', () => {
    assert.equal(stints.length, 2)
    assert.equal(stints[0].insurer, 'Oscar')
    assert.equal(ymd(stints[0].startDate), '2025-12-01')
    assert.equal(ymd(stints[0].endDate), '2026-02-01')
    assert.equal(stints[1].insurer, 'Ambetter')
    // el tramo de Ambetter arranca el mes siguiente al fin del de Oscar
    assert.equal(ymd(stints[1].startDate), '2026-03-01')
    assert.equal(stints[1].endDate, null)
  })
})

describe('stintCovers + atribución por mes (caso Mary Vivas)', () => {
  const history = [{ insurer: 'Oscar', startDate: period('2025-12'), endDate: period('2026-02') }]
  const stints = buildStints('Ambetter', d('2025-11-15'), history)
  const insurerForMonth = (ym: string) => {
    const s = stints.find(st => stintCovers(st, period(ym)))
    return s ? s.insurer : null
  }

  test('enero 2026 se atribuye a Oscar', () => {
    assert.equal(insurerForMonth('2026-01'), 'Oscar')
  })
  test('febrero 2026 se atribuye a Oscar', () => {
    assert.equal(insurerForMonth('2026-02'), 'Oscar')
  })
  test('marzo 2026 se atribuye a Ambetter', () => {
    assert.equal(insurerForMonth('2026-03'), 'Ambetter')
  })
  test('abril 2026 se atribuye a Ambetter', () => {
    assert.equal(insurerForMonth('2026-04'), 'Ambetter')
  })
  test('noviembre 2025 (antes de Oscar) no lo cubre ningún tramo', () => {
    assert.equal(insurerForMonth('2025-11'), null)
  })
})

describe('normalizeMonthDate + atribución con fechas UTC de Postgres (caso real Mary/Khaira)', () => {
  // Postgres/Prisma devuelven las fechas de InsurerHistory como medianoche
  // UTC (ej. "2026-02-01T00:00:00.000Z"). En zonas horarias detrás de UTC,
  // sin normalizar esto se interpretaba como "2026-01-31", corriendo todos
  // los tramos un mes y atribuyendo mal la comisión.
  test('Khaira: Oscar ene–may (endDate UTC = 2026-05-01), Ambetter desde junio', () => {
    const history = [{
      insurer: 'Oscar',
      startDate: normalizeMonthDate(new Date('2026-01-01T00:00:00.000Z')),
      endDate: normalizeMonthDate(new Date('2026-05-01T00:00:00.000Z')),
    }]
    const stints = buildStints('Ambetter', new Date('2025-11-09T00:00:00.000Z'), history)
    const insurerForMonth = (ym: string) => {
      const [y, m] = ym.split('-').map(Number)
      const s = stints.find(st => stintCovers(st, new Date(y, m - 1, 1)))
      return s ? s.insurer : null
    }
    assert.equal(insurerForMonth('2026-05'), 'Oscar')
    assert.equal(insurerForMonth('2026-06'), 'Ambetter')
  })

  test('Mary: Oscar ene–feb (endDate UTC = 2026-02-01), Ambetter desde marzo', () => {
    const history = [{
      insurer: 'Oscar',
      startDate: normalizeMonthDate(new Date('2026-01-01T00:00:00.000Z')),
      endDate: normalizeMonthDate(new Date('2026-02-01T00:00:00.000Z')),
    }]
    const stints = buildStints('Ambetter', new Date('2025-11-11T00:00:00.000Z'), history)
    const insurerForMonth = (ym: string) => {
      const [y, m] = ym.split('-').map(Number)
      const s = stints.find(st => stintCovers(st, new Date(y, m - 1, 1)))
      return s ? s.insurer : null
    }
    assert.equal(insurerForMonth('2026-02'), 'Oscar')
    assert.equal(insurerForMonth('2026-03'), 'Ambetter')
  })
})

describe('monthsBetween — meses completos transcurridos (Washington National)', () => {
  test('exactamente 7 meses', () => {
    assert.equal(monthsBetween(d('2026-01-15'), d('2026-08-15')), 7)
  })
  test('un día antes de cumplir el mes 7 → 6 meses', () => {
    assert.equal(monthsBetween(d('2026-01-15'), d('2026-08-14')), 6)
  })
  test('fecha futura invertida → 0 (nunca negativo)', () => {
    assert.equal(monthsBetween(d('2026-08-15'), d('2026-01-15')), 0)
  })
})

describe('wnCommission — 30% anualizado, split 75/25', () => {
  test('prima $100/mes → comisión total $360, primer pago $270, segundo $90', () => {
    const c = wnCommission(100)
    assert.equal(c.totalCommission, 360)
    assert.equal(c.firstPayment, 270)
    assert.equal(c.secondPayment, 90)
  })
  test('prima $0 → todo en cero', () => {
    const c = wnCommission(0)
    assert.equal(c.totalCommission, 0)
    assert.equal(c.firstPayment, 0)
    assert.equal(c.secondPayment, 0)
  })
})
