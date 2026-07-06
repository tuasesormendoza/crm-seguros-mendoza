'use client'

// Reclamos / Siniestros — SOLO clientes con Washington National.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRole } from '@/hooks/useRole'
import AccessDenied from '@/components/AccessDenied'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Claim {
  id: string; type: string; status: string; claimNumber: string | null
  serviceDate: string | null; filedDate: string | null
  amount: number | null; amountPaid: number | null; notes: string | null
  client: { id: string; fullName: string }
}
interface WnClient { id: string; fullName: string }

const TYPES = ['Hospitalización', 'Accidente', 'Cáncer', 'Enfermedad crítica', 'Incapacidad', 'Otro']
const STATUSES = ['Reportado', 'Documentos pendientes', 'Enviado a WN', 'En revisión', 'Aprobado', 'Pagado', 'Rechazado']
const STATUS_META: Record<string, { bg: string; color: string }> = {
  'Reportado':            { bg: '#f1f5f9', color: '#475569' },
  'Documentos pendientes':{ bg: '#fef3c7', color: '#92400e' },
  'Enviado a WN':         { bg: '#dbeafe', color: '#1e40af' },
  'En revisión':          { bg: '#f3e8ff', color: '#6b21a8' },
  'Aprobado':             { bg: '#d1fae5', color: '#065f46' },
  'Pagado':               { bg: '#dcfce7', color: '#166534' },
  'Rechazado':            { bg: '#fee2e2', color: '#991b1b' },
}
const OPEN_STATUSES = ['Reportado', 'Documentos pendientes', 'Enviado a WN', 'En revisión']

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
const LABEL = 'block text-xs font-semibold text-gray-600 mb-1'

export default function ReclamosPage() {
  const role = useRole()
  const [claims, setClaims] = useState<Claim[]>([])
  const [wnClients, setWnClients] = useState<WnClient[]>([])
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ clientId: '', type: 'Hospitalización', status: 'Reportado', claimNumber: '', serviceDate: '', filedDate: '', amount: '', amountPaid: '', notes: '' })

  const load = useCallback(() => {
    fetch('/api/claims').then(r => r.json()).then(d => setClaims(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    fetch('/api/clients?wn=con')
      .then(r => r.json())
      .then((d: WnClient[]) => setWnClients(Array.isArray(d) ? d.map(c => ({ id: c.id, fullName: c.fullName })) : []))
      .catch(() => {})
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) { setError('Elige un cliente.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/claims', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Error al crear'); return }
    setShowForm(false)
    setForm({ clientId: '', type: 'Hospitalización', status: 'Reportado', claimNumber: '', serviceDate: '', filedDate: '', amount: '', amountPaid: '', notes: '' })
    load()
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/claims/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar este reclamo?')) return
    await fetch(`/api/claims/${id}`, { method: 'DELETE' })
    load()
  }

  if (role === null) return <div className="text-center text-gray-400 mt-20">Cargando...</div>
  if (role === 'assistant') return <AccessDenied />

  const shown = filter ? claims.filter(c => c.status === filter) : claims
  const openCount = claims.filter(c => OPEN_STATUSES.includes(c.status)).length
  const paidTotal = claims.filter(c => c.status === 'Pagado').reduce((s, c) => s + (c.amountPaid || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>🏥 Reclamos Washington National</h1>
          <p className="text-sm text-gray-500 mt-1">Seguimiento de reclamos de clientes con póliza Washington National.</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setError('') }}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: '#10253f' }}>
          {showForm ? 'Cancelar' : '+ Nuevo reclamo'}
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 border" style={{ background: '#fff', borderColor: '#e5e7eb' }}>
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold" style={{ color: '#10253f' }}>{claims.length}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: '#fef3c7', borderColor: '#fef3c7' }}>
          <p className="text-xs text-gray-600 mb-1">Abiertos</p>
          <p className="text-2xl font-bold" style={{ color: '#92400e' }}>{openCount}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: '#dcfce7', borderColor: '#dcfce7' }}>
          <p className="text-xs text-gray-600 mb-1">Pagados</p>
          <p className="text-2xl font-bold" style={{ color: '#166534' }}>{claims.filter(c => c.status === 'Pagado').length}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: '#dbeafe', borderColor: '#dbeafe' }}>
          <p className="text-xs text-gray-600 mb-1">Total pagado</p>
          <p className="text-2xl font-bold" style={{ color: '#1e40af' }}>{formatCurrency(paidTotal)}</p>
        </div>
      </div>

      {/* Formulario nuevo */}
      {showForm && (
        <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4">
          <h2 className="font-bold text-base" style={{ color: '#10253f' }}>Nuevo reclamo</h2>
          {wnClients.length === 0 ? (
            <p className="text-sm text-amber-600">No tienes clientes con Washington National. Los reclamos solo aplican a esas pólizas.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Cliente (solo con WN)</label>
                  <select className={INPUT} value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required>
                    <option value="">— Elegir cliente —</option>
                    {wnClients.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Tipo de reclamo</label>
                  <select className={INPUT} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Estatus</label>
                  <select className={INPUT} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>N° de reclamo (WN)</label>
                  <input className={INPUT} value={form.claimNumber} onChange={e => setForm(f => ({ ...f, claimNumber: e.target.value }))} placeholder="Referencia de Washington National" />
                </div>
                <div>
                  <label className={LABEL}>Fecha del evento/servicio</label>
                  <input type="date" className={INPUT} value={form.serviceDate} onChange={e => setForm(f => ({ ...f, serviceDate: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>Fecha enviado a WN</label>
                  <input type="date" className={INPUT} value={form.filedDate} onChange={e => setForm(f => ({ ...f, filedDate: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>Monto reclamado ($)</label>
                  <input type="number" step="0.01" className={INPUT} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className={LABEL}>Monto pagado ($)</label>
                  <input type="number" step="0.01" className={INPUT} value={form.amountPaid} onChange={e => setForm(f => ({ ...f, amountPaid: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Notas</label>
                <textarea className={INPUT} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600">⚠️ {error}</p>}
              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50" style={{ background: '#2a6496' }}>
                  {saving ? 'Guardando...' : 'Crear reclamo'}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Filtro por estatus */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={filter === '' ? { background: '#10253f', color: '#fff', borderColor: '#10253f' } : { color: '#475569', borderColor: '#e2e8f0' }}>
          Todos ({claims.length})
        </button>
        {STATUSES.map(s => {
          const n = claims.filter(c => c.status === s).length
          if (n === 0) return null
          return (
            <button key={s} onClick={() => setFilter(s)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
              style={filter === s ? { background: '#10253f', color: '#fff', borderColor: '#10253f' } : { color: '#475569', borderColor: '#e2e8f0' }}>
              {s} ({n})
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {shown.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-gray-200">
          <div className="text-3xl mb-2">🗂️</div>
          <p className="text-sm text-gray-500">{claims.length === 0 ? 'Aún no hay reclamos registrados.' : 'Ningún reclamo con ese estatus.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map(c => {
            const meta = STATUS_META[c.status] || STATUS_META['Reportado']
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link href={`/clients/${c.client.id}`} className="font-semibold text-sm hover:underline" style={{ color: '#10253f' }}>{c.client.fullName}</Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {c.type}
                      {c.claimNumber && ` · N° ${c.claimNumber}`}
                      {c.serviceDate && ` · evento ${formatDate(c.serviceDate)}`}
                    </div>
                    {c.notes && <div className="text-xs text-gray-400 mt-1">{c.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: meta.bg, color: meta.color }}>{c.status}</span>
                    <button onClick={() => del(c.id)} className="text-xs text-gray-400 hover:text-red-600">🗑</button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                  <div className="text-xs text-gray-500">
                    {c.amount != null && <>Reclamado: <strong style={{ color: '#10253f' }}>{formatCurrency(c.amount)}</strong></>}
                    {c.amountPaid != null && <> · Pagado: <strong style={{ color: '#166534' }}>{formatCurrency(c.amountPaid)}</strong></>}
                  </div>
                  <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white">
                    {STATUSES.map(s => <option key={s} value={s}>Cambiar a: {s}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
