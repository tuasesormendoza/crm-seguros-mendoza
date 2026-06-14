'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { matchRows, type MatchResult } from '@/lib/statementImport'

interface ClientRow {
  id: string
  fullName: string
  insurer: string
  acaCommission: number
  expectedForPeriod?: number
  dependentNames?: string[]
  insurers?: string[]  // actual + historial de aseguradoras
}

interface Props {
  period: string                       // "YYYY-MM" que se está conciliando
  clients: ClientRow[]                 // TODOS los clientes activos (con su aseguradora)
  onApplied: () => void                // refrescar datos tras conciliar
  onPeriodChange: (period: string) => void  // cambiar el mes a conciliar
}

// Fila editable del previo (permite corregir el emparejamiento a mano)
type Row = MatchResult & { ignore: boolean }

type RawRow = { name: string; amount: number }

export default function StatementImport({ period, clients, onApplied, onPeriodChange }: Props) {
  const [insurer, setInsurer] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  // Subida de PDF
  const [uploading, setUploading] = useState(false)
  const [pdfInfo, setPdfInfo] = useState<string | null>(null)
  const [pendingRows, setPendingRows] = useState<RawRow[] | null>(null)
  // Motivo del faltante por cliente: clientId → 'broker' | 'cancelled'
  const [missingReasons, setMissingReasons] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  // Aseguradoras que ha tenido un cliente (actual + historial). Así un cliente
  // que se cambió de aseguradora aparece en el pool de AMBAS.
  const insurersOf = (c: ClientRow) => (c.insurers && c.insurers.length ? c.insurers : [c.insurer]).filter(Boolean)

  // Aseguradoras disponibles (distintas, con su conteo de clientes)
  const insurerOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of clients) {
      for (const ins of new Set(insurersOf(c))) counts.set(ins, (counts.get(ins) ?? 0) + 1)
    }
    return [...counts.entries()].map(([insurer, count]) => ({ insurer, count })).sort((a, b) => a.insurer.localeCompare(b.insurer))
  }, [clients])

  // Para emparejar y para el menú manual usamos TODOS los clientes (no solo los
  // de la aseguradora): así un cliente que se cambió de aseguradora — aunque su
  // cambio no esté registrado — igual se reconoce por su nombre. Cada cliente
  // lleva sus dependientes como alias.
  const candidates = useMemo(
    () => clients
      .map(c => ({ id: c.id, fullName: c.fullName, expected: c.expectedForPeriod ?? c.acaCommission, aliases: c.dependentNames ?? [] }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [clients]
  )

  // Pool de la aseguradora seleccionada (actual + historial) — solo para mostrar
  // qué clientes de ESA aseguradora no aparecieron en el estado de cuenta.
  const insurerPool = useMemo(
    () => clients.filter(c => insurersOf(c).includes(insurer)).map(c => c.id),
    [clients, insurer]
  )

  const periodLabel = useMemo(() => {
    const [y, m] = period.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }, [period])

  function runMatch(raw: RawRow[]) {
    const parsed = raw.map(r => ({ rawLine: r.name, name: r.name, amount: r.amount }))
    const results = matchRows(parsed, candidates)
    setRows(results.map(r => ({ ...r, ignore: false })))
  }

  // Cuando un PDF deja filas pendientes y ya hay candidatos para la aseguradora/mes
  // detectados (tras recargar la conciliación de ese periodo), empareja solo.
  useEffect(() => {
    if (pendingRows && candidates.length > 0) {
      runMatch(pendingRows)
      setPendingRows(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRows, candidates])

  // Si los candidatos cambian (ej. el PDF detectó el período del estado de
  // cuenta y se recargó la conciliación de ESE mes), refresca el "esperado"
  // de las filas ya emparejadas — si no, quedan con el monto del período que
  // estaba seleccionado en el momento del emparejamiento inicial.
  useEffect(() => {
    setRows(prev => {
      if (!prev) return prev
      return prev.map(r => {
        if (!r.matchedClientId) return r
        const cand = candidates.find(c => c.id === r.matchedClientId)
        return cand ? { ...r, expected: cand.expected } : r
      })
    })
  }, [candidates])

  async function handlePdf(file: File) {
    setError(''); setRows(null); setPdfInfo(null); setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/commissions/parse-statement', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'No se pudo leer el PDF.'); return }

      const detectedInsurer: string | null = data.insurer
      const matchedInsurer = detectedInsurer
        ? insurerOptions.find(i => i.insurer.toLowerCase() === detectedInsurer.toLowerCase())?.insurer ?? ''
        : ''
      if (matchedInsurer) setInsurer(matchedInsurer)
      if (data.period && /^\d{4}-\d{2}$/.test(data.period)) onPeriodChange(data.period)

      setPdfInfo(
        `Leídos ${data.rows.length} cliente(s)` +
        (detectedInsurer ? ` · ${detectedInsurer}` : '') +
        (data.period ? ` · ${data.period}` : '') +
        (data.totalPayment != null ? ` · total ${formatCurrency(data.totalPayment)}` : '')
      )
      // Deja las filas pendientes; el efecto las empareja cuando lleguen los candidatos.
      setPendingRows(data.rows as RawRow[])
    } catch {
      setError('No se pudo subir el PDF. Intenta de nuevo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function setRowClient(idx: number, clientId: string) {
    setRows(prev => {
      if (!prev) return prev
      const copy = [...prev]
      const cand = candidates.find(c => c.id === clientId)
      copy[idx] = {
        ...copy[idx],
        matchedClientId: clientId || null,
        matchedClientName: cand ? cand.fullName : null,
        expected: cand ? cand.expected : null,
        status: clientId ? 'matched' : 'unmatched',
      }
      return copy
    })
  }

  function toggleIgnore(idx: number) {
    setRows(prev => prev ? prev.map((r, i) => i === idx ? { ...r, ignore: !r.ignore } : r) : prev)
  }

  // Filas que efectivamente se conciliarán (emparejadas y no ignoradas)
  const toApply = useMemo(
    () => (rows ?? []).filter(r => r.matchedClientId && !r.ignore),
    [rows]
  )
  const matchedIds = useMemo(() => [...new Set(toApply.map(r => r.matchedClientId!))], [toApply])
  const totalAmount = useMemo(() => toApply.reduce((s, r) => s + r.amount, 0), [toApply])

  // Resumen POR CLIENTE: agrupa las líneas del estado de cuenta por cliente
  // (un cliente puede venir en varias líneas, ej. un dependiente aparte) y suma
  // lo recibido para compararlo contra lo esperado. Así NO se "cuadra" nada: si
  // a un cliente le pagaron de menos, se ve claro.
  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; received: number; expected: number }>()
    for (const r of toApply) {
      const id = r.matchedClientId!
      const e = map.get(id) ?? { name: r.matchedClientName ?? r.name, received: 0, expected: r.expected ?? 0 }
      e.received += r.amount
      map.set(id, e)
    }
    return [...map.entries()].map(([clientId, v]) => ({ clientId, ...v }))
  }, [toApply])

  const expectedTotal = useMemo(() => byClient.reduce((s, c) => s + (c.expected || 0), 0), [byClient])
  // Clientes a los que se les pagó MENOS de lo esperado (posible error del broker).
  const underpaid = useMemo(() => byClient.filter(c => c.expected > 0 && c.received < c.expected - 0.01), [byClient])

  // Clientes de la aseguradora seleccionada que NO aparecieron en el estado de
  // cuenta (faltantes: error del broker o cliente que canceló).
  const missing = useMemo(() => {
    const matchedSet = new Set(matchedIds)
    const poolSet = new Set(insurerPool)
    return candidates.filter(c => poolSet.has(c.id) && !matchedSet.has(c.id))
  }, [candidates, insurerPool, matchedIds])

  async function apply() {
    if (!insurer) { setError('Selecciona la aseguradora para registrar el pago.'); return }
    if (matchedIds.length === 0) { setError('No hay clientes emparejados para conciliar.'); return }
    setApplying(true)
    setError('')
    try {
      // 1. Marca recibido a los emparejados, y registra los faltantes con su
      // motivo (reclamar al broker / canceló) para darles seguimiento.
      const gaps = missing
        .filter(c => missingReasons[c.id])
        .map(c => ({ clientId: c.id, gapReason: missingReasons[c.id] }))
      await fetch('/api/commission-checks/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: matchedIds, period, received: true, gaps }),
      })
      // 2. Registra el pago total recibido de esta aseguradora para el periodo,
      // con el detalle por cliente (qué cliente y cuánto pagó cada uno).
      const items = toApply.map(r => ({
        clientId: r.matchedClientId,
        name: r.matchedClientName ?? r.name,
        amount: r.amount,
      }))
      await fetch('/api/commission-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurer, period, amount: Math.round(totalAmount * 100) / 100,
          receivedDate: new Date().toISOString().slice(0, 10),
          notes: 'Importado de estado de cuenta',
          items,
        }),
      })
      setRows(null); setInsurer(''); setMissingReasons({}); setPdfInfo(null)
      onApplied()
    } catch {
      setError('Ocurrió un error al conciliar. Intenta de nuevo.')
    } finally {
      setApplying(false)
    }
  }

  const CARD = 'bg-white rounded-xl border border-gray-200 p-5'
  const INPUT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
  const TH = 'text-xs font-semibold uppercase tracking-wide py-2 px-3 text-left'
  const TD = 'py-2 px-3 text-sm text-gray-800'

  const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    matched:   { label: '✅ Emparejado', bg: '#dcfce7', color: '#166534' },
    review:    { label: '🔎 Revisar',    bg: '#fef3c7', color: '#92400e' },
    unmatched: { label: '⚠️ Sin match',  bg: '#fee2e2', color: '#991b1b' },
  }

  return (
    <div className="space-y-6">
      <div className={CARD}>
        <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>📥 Importar estado de cuenta</h2>
        <p className="text-xs text-gray-500 mt-1">
          Sube el PDF del estado de cuenta de tu broker y el sistema lee automáticamente los nombres y montos,
          detecta la aseguradora y el mes, y empareja cada cliente para marcar las comisiones recibidas de un solo paso.
        </p>

        {/* Subir PDF (método principal) */}
        <div className="mt-4 rounded-xl p-4 text-center" style={{ background: '#f0f7fb', border: '2px dashed #b8d4e8' }}>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePdf(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#305a72' }}
          >
            {uploading ? '⏳ Leyendo PDF...' : '📄 Subir PDF del estado de cuenta'}
          </button>
          <p className="text-xs text-gray-500 mt-2">El archivo se procesa en tu sistema; reconoce tablas con columnas de cliente y monto.</p>
          {pdfInfo && (
            <p className="text-xs font-semibold mt-2" style={{ color: '#166534' }}>✅ {pdfInfo}</p>
          )}
          {pendingRows && candidates.length === 0 && (
            <p className="text-xs mt-2" style={{ color: '#92400e' }}>
              Aún no tienes clientes cargados para emparejar.
            </p>
          )}
        </div>

        {/* Mes y aseguradora — los detecta el PDF; puedes ajustarlos si hace falta */}
        {(rows || pdfInfo) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes que cubre (detectado)</label>
              <input
                type="month"
                value={period}
                onChange={e => onPeriodChange(e.target.value)}
                className={INPUT}
              />
              <span className="text-xs text-gray-400 ml-2 capitalize">{periodLabel}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora (detectada)</label>
              <select value={insurer} onChange={e => setInsurer(e.target.value)} className={INPUT + ' w-full'}>
                <option value="">Seleccionar...</option>
                {insurerOptions.map(i => (
                  <option key={i.insurer} value={i.insurer}>{i.insurer} ({i.count} clientes)</option>
                ))}
              </select>
              {insurer && insurerPool.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No tienes clientes registrados con esta aseguradora.</p>
              )}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>

      {/* Previo de emparejamiento */}
      {rows && (
        <div className={CARD}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-semibold text-base" style={{ color: '#10253f' }}>Revisión del emparejamiento</h3>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-1 rounded-full font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                {byClient.length} cliente(s) en el pago
              </span>
              <span className="px-2 py-1 rounded-full font-semibold" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                Recibido: {formatCurrency(totalAmount)}
              </span>
              <span className="px-2 py-1 rounded-full font-semibold" style={{ background: '#dbeafe', color: '#1e40af' }}>
                Esperado: {formatCurrency(expectedTotal)}
              </span>
              {Math.abs(totalAmount - expectedTotal) > 0.01 && (
                <span className="px-2 py-1 rounded-full font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
                  Diferencia: {totalAmount - expectedTotal > 0 ? '+' : ''}{formatCurrency(totalAmount - expectedTotal)}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th className={TH} style={{ color: '#507b88' }}>Del estado de cuenta</th>
                  <th className={TH} style={{ color: '#507b88' }}>Monto</th>
                  <th className={TH} style={{ color: '#507b88' }}>Cliente emparejado</th>
                  <th className={TH} style={{ color: '#507b88' }}>Estado</th>
                  <th className={TH} style={{ color: '#507b88' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const badge = STATUS_BADGE[r.status]
                  return (
                    <tr key={idx} className="border-b border-gray-50" style={r.ignore ? { opacity: 0.4 } : {}}>
                      <td className={TD}>{r.name}</td>
                      <td className={TD + ' font-semibold'}>{formatCurrency(r.amount)}</td>
                      <td className={TD}>
                        <select
                          value={r.matchedClientId ?? ''}
                          onChange={e => setRowClient(idx, e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white max-w-[200px]"
                        >
                          <option value="">— Sin emparejar —</option>
                          {candidates.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                        </select>
                      </td>
                      <td className={TD}>
                        <span className="text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={TD}>
                        <button onClick={() => toggleIgnore(idx)} className="text-xs text-gray-400 hover:text-gray-700 underline">
                          {r.ignore ? 'incluir' : 'ignorar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Panel de DISCREPANCIAS — el objetivo no es "cuadrar", sino mostrar
              claramente lo que NO coincide para que lo revises (error del broker
              o cancelación del cliente). */}
          {(missing.length > 0 || underpaid.length > 0) ? (
            <div className="mt-4 space-y-3">
              {missing.length > 0 && (
                <div className="p-3 rounded-lg" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#991b1b' }}>
                    🔴 {missing.length} cliente(s) que esperabas de {insurer || 'esta aseguradora'} NO están en este pago
                  </p>
                  <p className="text-[11px] mb-2" style={{ color: '#b91c1c' }}>
                    Marca el motivo de cada uno para darle seguimiento: <strong>reclamar al broker</strong> (posible error) o que el <strong>cliente canceló</strong>.
                  </p>
                  <div className="space-y-1.5">
                    {missing.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 flex-wrap">
                        <a href={`/clients/${c.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium hover:underline" style={{ color: '#991b1b' }}>
                          {c.fullName} ↗
                        </a>
                        <select
                          value={missingReasons[c.id] ?? ''}
                          onChange={e => setMissingReasons(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="text-xs border rounded-lg px-2 py-1 bg-white"
                          style={{ borderColor: '#fecaca', color: '#991b1b' }}
                        >
                          <option value="">Motivo...</option>
                          <option value="broker">🔴 Reclamar al broker</option>
                          <option value="cancelled">⚪ El cliente canceló</option>
                          <option value="switched">🔵 Está con otra aseguradora</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {underpaid.length > 0 && (
                <div className="p-3 rounded-lg" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: '#9a3412' }}>
                    🟠 {underpaid.length} cliente(s) con pago MENOR a lo esperado (posible pago incompleto del broker)
                  </p>
                  <div className="space-y-1">
                    {underpaid.map(c => (
                      <div key={c.clientId} className="flex items-center justify-between text-xs" style={{ color: '#9a3412' }}>
                        <span>{c.name}</span>
                        <span>recibió <strong>{formatCurrency(c.received)}</strong> de <strong>{formatCurrency(c.expected)}</strong> <span style={{ color: '#991b1b' }}>(faltan {formatCurrency(c.expected - c.received)})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            byClient.length > 0 && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="text-xs font-semibold" style={{ color: '#166534' }}>
                  ✅ Todo cuadra: cada cliente esperado de {insurer} aparece en el pago con el monto correcto.
                </p>
              </div>
            )
          )}

          <div className="flex items-center justify-end gap-3 mt-4">
            <button onClick={() => setRows(null)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={apply}
              disabled={applying || matchedIds.length === 0}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#166534' }}
            >
              {applying ? 'Conciliando...' : `✅ Conciliar ${matchedIds.length} cliente(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
