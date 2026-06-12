'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'
import { parseStatement, matchRows, type MatchResult } from '@/lib/statementImport'

interface ClientRow {
  id: string
  fullName: string
  insurer: string
  acaCommission: number
  dependentNames?: string[]
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
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  // Subida de PDF
  const [uploading, setUploading] = useState(false)
  const [pdfInfo, setPdfInfo] = useState<string | null>(null)
  const [pendingRows, setPendingRows] = useState<RawRow[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Aseguradoras disponibles (distintas, con su conteo de clientes)
  const insurerOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of clients) {
      if (!c.insurer) continue
      counts.set(c.insurer, (counts.get(c.insurer) ?? 0) + 1)
    }
    return [...counts.entries()].map(([insurer, count]) => ({ insurer, count })).sort((a, b) => a.insurer.localeCompare(b.insurer))
  }, [clients])

  // Candidatos = TODOS los clientes de la aseguradora seleccionada (no solo los
  // "esperados" del mes), con sus dependientes como alias para emparejar.
  const candidates = useMemo(
    () => clients
      .filter(c => c.insurer === insurer)
      .map(c => ({ id: c.id, fullName: c.fullName, expected: c.acaCommission, aliases: c.dependentNames ?? [] })),
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

  function analyze() {
    setError('')
    if (!insurer) { setError('Selecciona la aseguradora del estado de cuenta.'); return }
    if (!text.trim()) { setError('Pega el contenido del estado de cuenta.'); return }
    const parsed = parseStatement(text)
    if (parsed.length === 0) {
      setError('No se reconoció ninguna línea con nombre y monto. Revisa el formato (un cliente por línea, con el monto al final).')
      setRows(null)
      return
    }
    runMatch(parsed.map(p => ({ name: p.name, amount: p.amount })))
  }

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

  // Clientes esperados que NO aparecieron en el estado de cuenta (posibles faltantes)
  const missing = useMemo(() => {
    const matchedSet = new Set(matchedIds)
    return candidates.filter(c => !matchedSet.has(c.id))
  }, [candidates, matchedIds])

  async function apply() {
    if (matchedIds.length === 0) { setError('No hay clientes emparejados para conciliar.'); return }
    setApplying(true)
    setError('')
    try {
      // 1. Marca como recibido a los clientes emparejados, en este periodo
      await fetch('/api/commission-checks/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: matchedIds, period, received: true }),
      })
      // 2. Registra el pago total recibido de esta aseguradora para el periodo
      await fetch('/api/commission-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insurer, period, amount: Math.round(totalAmount * 100) / 100,
          receivedDate: new Date().toISOString().slice(0, 10),
          notes: 'Importado de estado de cuenta',
        }),
      })
      setRows(null); setText(''); setInsurer('')
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
              Ajusta el mes o la aseguradora abajo para ver los clientes esperados y emparejar.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">o pega el texto manualmente</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Mes que cubre el estado de cuenta</label>
          <input
            type="month"
            value={period}
            onChange={e => { onPeriodChange(e.target.value); setRows(null) }}
            className={INPUT}
          />
          <span className="text-xs text-gray-400 ml-2">Conciliando: <strong>{periodLabel}</strong></span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora</label>
            <select value={insurer} onChange={e => { setInsurer(e.target.value); setRows(null) }} className={INPUT + ' w-full'}>
              <option value="">Seleccionar...</option>
              {insurerOptions.map(i => (
                <option key={i.insurer} value={i.insurer}>{i.insurer} ({i.count} clientes)</option>
              ))}
            </select>
            {insurer && candidates.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No tienes clientes activos con esta aseguradora.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado de cuenta (pega aquí)</label>
            <textarea
              value={text} onChange={e => setText(e.target.value)} rows={5}
              placeholder={'Pega el contenido, un cliente por línea con el monto al final. Ej:\nMARY VIVAS    18.00\nOSCAR HERNANDEZ    54.00'}
              className={INPUT + ' w-full font-mono text-xs'}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button onClick={analyze} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#305a72' }}>
            Analizar
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {/* Previo de emparejamiento */}
      {rows && (
        <div className={CARD}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-semibold text-base" style={{ color: '#10253f' }}>Revisión del emparejamiento</h3>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2 py-1 rounded-full font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                {toApply.length} a conciliar
              </span>
              <span className="px-2 py-1 rounded-full font-semibold" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
                Total: {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th className={TH} style={{ color: '#507b88' }}>Del estado de cuenta</th>
                  <th className={TH} style={{ color: '#507b88' }}>Monto</th>
                  <th className={TH} style={{ color: '#507b88' }}>Cliente emparejado</th>
                  <th className={TH} style={{ color: '#507b88' }}>Esperado</th>
                  <th className={TH} style={{ color: '#507b88' }}>Estado</th>
                  <th className={TH} style={{ color: '#507b88' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const badge = STATUS_BADGE[r.status]
                  const diff = r.expected != null ? Math.round((r.amount - r.expected) * 100) / 100 : null
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
                        {r.expected != null ? (
                          <span>
                            {formatCurrency(r.expected)}
                            {diff !== null && diff !== 0 && (
                              <span className="ml-1 text-xs font-semibold" style={{ color: diff > 0 ? '#166534' : '#991b1b' }}>
                                ({diff > 0 ? '+' : ''}{formatCurrency(diff)})
                              </span>
                            )}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
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

          {missing.length > 0 && (
            <div className="mt-4 p-3 rounded-lg" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <p className="text-xs font-semibold" style={{ color: '#9a3412' }}>
                ⚠️ {missing.length} cliente(s) esperado(s) NO aparecen en este estado de cuenta:
              </p>
              <p className="text-xs mt-1" style={{ color: '#9a3412' }}>
                {missing.map(c => c.fullName).join(', ')}
              </p>
            </div>
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
