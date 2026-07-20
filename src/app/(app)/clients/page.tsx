'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  'Activo':            '#059669',
  'Cancelado':         '#dc2626',
  'Con otro agente':   '#dc2626',
  'Pendiente de Pago': '#d97706',
  'Renovado':          '#2563eb',
  'En Proceso':        '#7c3aed',
}
const STATUS_BG: Record<string, string> = {
  'Activo':            '#d1fae5',
  'Cancelado':         '#fee2e2',
  'Con otro agente':   '#fee2e2',
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
  cancellationDate: string | null
}

type SortKey = 'fullName' | 'state' | 'insurer' | 'totalMonthly' | 'renewalDate' | 'status'

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

const PAGE_SIZE = 50

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [availableStates, setAvailableStates] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [insurerFilter, setInsurerFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [wnFilter, setWnFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fullName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [recentlyCancelled, setRecentlyCancelled] = useState<Client[]>([])

  // Clientes perdidos este mes — una sola petición ligera (el filtro por mes y
  // la selección de campos ocurren en el servidor).
  useEffect(() => {
    fetch('/api/clients?recentlyLost=1')
      .then(r => r.json())
      .then((lost: Client[]) => setRecentlyCancelled(Array.isArray(lost) ? lost : []))
      .catch(() => {}) // banner opcional: si falla, la lista principal sigue funcionando
  }, [])

  // Toda la búsqueda/filtrado/orden/paginación ocurre en el SERVIDOR (rápido y
  // sin traer todos los clientes al navegador).
  const fetchClients = useCallback(() => {
    const params = new URLSearchParams({
      paginated: '1', page: String(page), pageSize: String(PAGE_SIZE),
      sort: sortKey, dir: sortDir,
    })
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (insurerFilter) params.set('insurer', insurerFilter)
    if (stateFilter) params.set('state', stateFilter)
    if (tagFilter) params.set('tag', tagFilter)
    if (wnFilter) params.set('wn', wnFilter)
    setLoading(true)
    fetch(`/api/clients?${params}`).then(r => r.json()).then((data) => {
      setClients(data.clients || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (Array.isArray(data.states)) setAvailableStates(data.states)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [page, search, statusFilter, insurerFilter, stateFilter, tagFilter, wnFilter, sortKey, sortDir])

  useEffect(() => {
    const t = setTimeout(fetchClients, 300)
    return () => clearTimeout(t)
  }, [fetchClients])

  // Volver a la página 1 cuando cambian los filtros o el orden.
  useEffect(() => { setPage(1) }, [search, statusFilter, insurerFilter, stateFilter, tagFilter, wnFilter, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Clientes</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {total} cliente(s){totalPages > 1 ? ` · página ${page} de ${totalPages}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/clients" download
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,.7)', border: '1px solid rgba(var(--brand-500-rgb), .25)', color: '#334155', backdropFilter: 'blur(8px)' }}>
            ⬇️ CSV
          </a>
          <Link href="/clients/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--brand-800), var(--brand-500))', boxShadow: '0 2px 12px rgba(var(--brand-800-rgb), .30)' }}>
            + Nuevo Cliente
          </Link>
        </div>
      </div>

      {/* Clientes perdidos este mes */}
      {recentlyCancelled.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-sm font-bold" style={{ color: '#991b1b' }}>
              🔴 {recentlyCancelled.length} cliente{recentlyCancelled.length > 1 ? 's' : ''} perdido{recentlyCancelled.length > 1 ? 's' : ''} este mes
            </p>
            <button
              onClick={() => setStatusFilter('Cancelado')}
              className="text-xs underline"
              style={{ color: '#991b1b' }}
            >
              Ver todos los cancelados →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentlyCancelled.map(c => (
              <a
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ background: '#fee2e2', color: '#991b1b' }}
              >
                <span>{c.fullName}</span>
                {c.cancellationDate && (
                  <span className="opacity-60">
                    · {new Date(c.cancellationDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
            style={INPUT_STYLE}
          />
          {/* En móvil: 2 columnas parejas (la última fila a ancho completo).
              En escritorio: los 5 filtros en una sola fila. */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full min-w-0" style={INPUT_STYLE}>
              <option value="">Todos los estatus</option>
              {['Activo','Cancelado','Con otro agente','Pendiente de Pago','Renovado','En Proceso'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={insurerFilter} onChange={e => setInsurerFilter(e.target.value)} className="w-full min-w-0" style={INPUT_STYLE}>
              <option value="">Todas las aseguradoras</option>
              {['Alliant','Ambetter','AmeriHealth','Anthem','AvMed','Blue Cross Blue Shield','CareSource','Christus','Cigna','Community','Health First','Health Spring','Highmark','Imperial','Kaiser','LA Care','Medica','Molina','Oscar','Select Health','UnitedHealthcare'].map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="w-full min-w-0" style={INPUT_STYLE}>
              <option value="">Todos los estados</option>
              {availableStates.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={wnFilter} onChange={e => setWnFilter(e.target.value)} className="w-full min-w-0" style={INPUT_STYLE}>
              <option value="">WN: Todos</option>
              <option value="con">Con Washington National</option>
              <option value="sin">Sin Washington National</option>
            </select>
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="w-full min-w-0 col-span-2 md:col-span-1" style={INPUT_STYLE}>
              <option value="">Todas las etiquetas</option>
              {PREDEFINED_TAGS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Mobile card list (hidden on md+) ─────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading && <div className="text-center py-10 text-gray-400">⏳ Cargando...</div>}
        {!loading && clients.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-sm font-medium">No se encontraron clientes</div>
            <div className="text-xs mt-1">Prueba ajustando los filtros</div>
          </div>
        )}
        {clients.map(c => {
          const wnTypes = getWNTypes(c.wnPolicies)
          const wn = wnTypes.length > 0
          let tags: string[] = []
          try { tags = JSON.parse(c.tags || '[]') } catch { tags = [] }
          return (
            // La tarjeta navega al perfil con router.push en vez de envolver
            // todo en un <Link>, así los <a> de ContactButtons no quedan
            // anidados dentro de otro <a> (HTML inválido → error de hidratación).
            <div key={c.id}
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/clients/${c.id}`)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/clients/${c.id}`) } }}
              className="block rounded-2xl p-4 cursor-pointer active:opacity-80"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: '#0f172a' }}>{c.fullName}</div>
                  {c.email && <div className="text-xs truncate mt-0.5" style={{ color: '#64748b' }}>{c.email}</div>}
                </div>
                {c.status && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: STATUS_BG[c.status] || '#f1f5f9', color: STATUS_COLOR[c.status] || '#475569' }}>
                    {c.status}
                  </span>
                )}
              </div>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                <div><span style={{ color: '#94a3b8' }}>Aseguradora</span><br /><span style={{ color: '#0f172a' }}>{c.insurer || '—'} {c.planCategory ? `· ${c.planCategory}` : ''}</span></div>
                <div><span style={{ color: '#94a3b8' }}>Total/mes</span><br /><span className="font-semibold" style={{ color: '#0f172a' }}>{formatCurrency(c.totalMonthly)}</span></div>
                <div><span style={{ color: '#94a3b8' }}>Cobertura</span><br /><span style={{ color: '#334155' }}>{c.coverageType || '—'}</span></div>
                <div><span style={{ color: '#94a3b8' }}>Renovación</span><br /><span style={{ color: '#334155' }}>{formatDate(c.renewalDate) || '—'}</span></div>
                {c.state && <div><span style={{ color: '#94a3b8' }}>Estado</span><br /><span style={{ color: '#334155' }}>{c.state}</span></div>}
                {wn && <div><span style={{ color: '#94a3b8' }}>Washington Nat.</span><br /><span className="font-semibold" style={{ color: '#1e40af' }}>✓ WN</span></div>}
              </div>
              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.slice(0, 3).map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ background: TAG_COLORS[t] || '#2a6496' }}>{t}</span>
                  ))}
                </div>
              )}
              {/* Actions — stopPropagation evita que el tap en WhatsApp/teléfono
                  dispare la navegación de la tarjeta. */}
              {c.phone && (
                <div onClick={e => e.stopPropagation()}>
                  <ContactButtons clientName={c.fullName} clientPhone={c.phone} size="sm" showLabel={false} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Desktop table (hidden on mobile) ──────────────────────────────── */}
      <div className="hidden md:block" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
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
              {clients.map((c, idx) => {
                const wnTypes = getWNTypes(c.wnPolicies)
                const wn = wnTypes.length > 0
                return (
                  <tr key={c.id}
                    style={{ borderBottom: idx < clients.length - 1 ? '1px solid #e2e8f0' : 'none' }}
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
              {clients.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16" style={{ color: '#94a3b8' }}>
                    <div className="text-3xl mb-2">{loading ? '⏳' : '🔍'}</div>
                    <div className="text-sm font-medium">{loading ? 'Cargando...' : 'No se encontraron clientes'}</div>
                    {!loading && <div className="text-xs mt-1">Prueba ajustando los filtros</div>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white">
            ← Anterior
          </button>
          <span className="text-sm" style={{ color: '#64748b' }}>Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed bg-white">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
