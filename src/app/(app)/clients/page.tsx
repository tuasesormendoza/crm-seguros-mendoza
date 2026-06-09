'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { formatDate, formatCurrency } from '@/lib/utils'
import ContactButtons from '@/components/ContactButtons'

const PREDEFINED_TAGS = [
  'VIP', 'Necesita seguimiento', 'Problema de pago', 'Renovación próxima',
  'Cliente referido', 'Washington National', 'Documentos pendientes',
]

const TAG_COLORS: Record<string, string> = {
  'VIP': '#fbbf24',
  'Necesita seguimiento': '#f97316',
  'Problema de pago': '#ef4444',
  'Renovación próxima': '#8b5cf6',
  'Cliente referido': '#10b981',
  'Washington National': '#3b82f6',
  'Documentos pendientes': '#6366f1',
}

const STATUS_COLOR: Record<string, string> = {
  'Activo':           '#059669',
  'Cancelado':        '#dc2626',
  'Pendiente de Pago':'#d97706',
  'Renovado':         '#2563eb',
  'En Proceso':       '#7c3aed',
}
const STATUS_BG: Record<string, string> = {
  'Activo':           '#d1fae5',
  'Cancelado':        '#fee2e2',
  'Pendiente de Pago':'#fef3c7',
  'Renovado':         '#dbeafe',
  'En Proceso':       '#ede9fe',
}

interface Client {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  state: string | null
  insurer: string | null
  planCategory: string | null
  coverageType: string | null
  totalMonthly: number | null
  status: string | null
  renewalDate: string | null
  affiliatesCount: number | null
  tags: string | null
  wnPolicies: string | null
}

type SortKey = 'fullName' | 'state' | 'insurer' | 'totalMonthly' | 'renewalDate' | 'status'

function hasWN(wnPolicies: string | null): boolean {
  if (!wnPolicies) return false
  try {
    const arr = JSON.parse(wnPolicies)
    return Array.isArray(arr) && arr.some((p: { type?: string }) => p.type)
  } catch { return false }
}

function getWNTypes(wnPolicies: string | null): string[] {
  if (!wnPolicies) return []
  try {
    const arr = JSON.parse(wnPolicies)
    return Array.isArray(arr) ? arr.filter((p: { type?: string }) => p.type).map((p: { type: string }) => p.type) : []
  } catch { return [] }
}

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey
  current: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th className="text-left px-4 py-3 cursor-pointer select-none whitespace-nowrap"
      style={{ color: active ? '#0f172a' : '#64748b', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}
      onClick={() => onSort(sortKey)}>
      <span className="flex items-center gap-1">
        {label}
        <span style={{ opacity: active ? 1 : 0.25, fontSize: '10px' }}>
          {active && dir === 'desc' ? '▼' : '▲'}
        </span>
      </span>
    </th>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '.8125rem',
  color: '#0f172a',
  outline: 'none',
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [insurerFilter, setInsurerFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [wnFilter, setWnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fullName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const fetchClients = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (insurerFilter) params.set('insurer', insurerFilter)
    fetch(`/api/clients?${params}`).then(r => r.json()).then((data: Client[]) => {
      setClients(data)
    })
  }, [search, statusFilter, insurerFilter])

  useEffect(() => {
    const t = setTimeout(fetchClients, 300)
    return () => clearTimeout(t)
  }, [fetchClients])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = [...clients]
    if (stateFilter) list = list.filter(c => c.state === stateFilter)
    if (tagFilter) list = list.filter(c => {
      try { return JSON.parse(c.tags || '[]').includes(tagFilter) } catch { return false }
    })
    if (wnFilter === 'con') list = list.filter(c => hasWN(c.wnPolicies))
    if (wnFilter === 'sin') list = list.filter(c => !hasWN(c.wnPolicies))
    list.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'fullName')    { av = a.fullName ?? ''; bv = b.fullName ?? '' }
      if (sortKey === 'state')       { av = a.state ?? ''; bv = b.state ?? '' }
      if (sortKey === 'insurer')     { av = a.insurer ?? ''; bv = b.insurer ?? '' }
      if (sortKey === 'totalMonthly'){ av = a.totalMonthly ?? 0; bv = b.totalMonthly ?? 0 }
      if (sortKey === 'renewalDate') { av = a.renewalDate ?? ''; bv = b.renewalDate ?? '' }
      if (sortKey === 'status')      { av = a.status ?? ''; bv = b.status ?? '' }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [clients, stateFilter, tagFilter, wnFilter, sortKey, sortDir])

  const availableStates = useMemo(() =>
    [...new Set(clients.map(c => c.state).filter(Boolean) as string[])].sort(),
    [clients]
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Clientes</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>{filtered.length} de {clients.length} clientes</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/clients" download
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,.7)', border: '1px solid rgba(66,158,189,.25)', color: '#334155', backdropFilter: 'blur(8px)' }}>
            ⬇️ CSV
          </a>
          <Link href="/clients/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #053F5C, #429EBD)', boxShadow: '0 2px 12px rgba(5,63,92,.30)' }}>
            + Nuevo Cliente
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
        <div className="flex gap-2.5 flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...INPUT_STYLE, flex: '1', minWidth: '200px' }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={INPUT_STYLE}>
            <option value="">Todos los estatus</option>
            {['Activo','Cancelado','Pendiente de Pago','Renovado','En Proceso'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={insurerFilter} onChange={e => setInsurerFilter(e.target.value)} style={INPUT_STYLE}>
            <option value="">Todas las aseguradoras</option>
            {['Oscar','Ambetter','Cigna','Kaiser','Blue Cross Blue Shield','Anthem','UnitedHealthcare','Molina','CareSource','Alliant','AmeriHealth','Health Spring'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={INPUT_STYLE}>
            <option value="">Todos los estados</option>
            {availableStates.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={wnFilter} onChange={e => setWnFilter(e.target.value)} style={INPUT_STYLE}>
            <option value="">WN: Todos</option>
            <option value="con">Con Washington National</option>
            <option value="sin">Sin Washington National</option>
          </select>
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={INPUT_STYLE}>
            <option value="">Todas las etiquetas</option>
            {PREDEFINED_TAGS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <SortHeader label="Cliente"      sortKey="fullName"     current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Aseguradora"  sortKey="insurer"      current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 whitespace-nowrap" style={{ color: '#64748b', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Cobertura</th>
                <th className="text-left px-4 py-3 whitespace-nowrap" style={{ color: '#64748b', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Wash. National</th>
                <SortHeader label="Total/mes"    sortKey="totalMonthly" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Renovación"   sortKey="renewalDate"  current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Estado"       sortKey="state"        current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Estatus"      sortKey="status"       current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const wnTypes = getWNTypes(c.wnPolicies)
                const wn = wnTypes.length > 0
                return (
                  <tr key={c.id}
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #e2e8f0' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {/* Cliente */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="font-medium truncate" style={{ color: '#0f172a' }}>{c.fullName}</div>
                      <div className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>{c.email}</div>
                      {(() => {
                        try {
                          const tags: string[] = JSON.parse(c.tags || '[]')
                          return tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.slice(0,2).map(t => (
                                <span key={t} className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: TAG_COLORS[t] || '#2a6496' }}>
                                  {t}
                                </span>
                              ))}
                              {tags.length > 2 && <span className="text-xs" style={{ color: '#94a3b8' }}>+{tags.length - 2}</span>}
                            </div>
                          ) : null
                        } catch { return null }
                      })()}
                    </td>

                    {/* Aseguradora */}
                    <td className="px-4 py-3">
                      <div style={{ color: '#0f172a' }}>{c.insurer || '—'}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{c.planCategory}</div>
                    </td>

                    {/* Cobertura */}
                    <td className="px-4 py-3">
                      <div style={{ color: '#0f172a' }}>{c.coverageType || '—'}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>{c.affiliatesCount} afiliado(s)</div>
                    </td>

                    {/* Washington National */}
                    <td className="px-4 py-3">
                      {wn ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: '#dbeafe', color: '#1e40af' }}>
                            ✓ WN
                          </span>
                          {wnTypes.slice(0, 2).map((t, i) => (
                            <div key={i} className="text-xs mt-0.5 truncate max-w-[120px]" style={{ color: '#94a3b8' }}>{t}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>

                    {/* Total/mes */}
                    <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: '#0f172a' }}>
                      {formatCurrency(c.totalMonthly)}
                    </td>

                    {/* Renovación */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#475569' }}>
                      {formatDate(c.renewalDate)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#334155' }}>
                      {c.state || '—'}
                    </td>

                    {/* Estatus */}
                    <td className="px-4 py-3">
                      {c.status ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: '9999px',
                          fontSize: '.72rem', fontWeight: 600,
                          background: STATUS_BG[c.status] || '#f1f5f9',
                          color: STATUS_COLOR[c.status] || '#475569',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[c.status] || '#94a3b8', display: 'inline-block', flexShrink: 0 }} />
                          {c.status}
                        </span>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {c.phone && (
                          <ContactButtons clientName={c.fullName} clientPhone={c.phone} size="sm" showLabel={false} />
                        )}
                        <Link
                          href={`/clients/${c.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-80"
                          style={{ background: '#10253f' }}>
                          👁 Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16" style={{ color: '#94a3b8' }}>
                    <div className="text-3xl mb-2">🔍</div>
                    <div className="text-sm font-medium">No se encontraron clientes</div>
                    <div className="text-xs mt-1">Prueba ajustando los filtros</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
