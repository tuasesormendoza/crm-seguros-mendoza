'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRole } from '@/hooks/useRole'
import AccessDenied from '@/components/AccessDenied'

interface AuditLog {
  id: string
  userName: string | null
  userEmail: string | null
  action: string
  entity: string
  entityId: string | null
  entityLabel: string | null
  metadata: string | null
  ip: string | null
  createdAt: string
}

interface AuditResponse {
  logs: AuditLog[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const ACTION_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  create: { label: 'Creó',          bg: '#dcfce7', color: '#166534' },
  update: { label: 'Editó',         bg: '#dbeafe', color: '#1e40af' },
  delete: { label: 'Borró',         bg: '#fee2e2', color: '#991b1b' },
  export: { label: 'Exportó',       bg: '#fef3c7', color: '#92400e' },
  backup: { label: 'Respaldó',      bg: '#fef3c7', color: '#92400e' },
  login:  { label: 'Inició sesión', bg: '#f3e8ff', color: '#6b21a8' },
}

const ENTITY_LABEL: Record<string, string> = {
  client: 'Cliente',
  document: 'Documento',
  user: 'Usuario',
  prospect: 'Prospecto',
  commissionPayment: 'Pago de comisión',
  session: 'Sesión',
  data: 'Datos',
}

const ACTIONS = ['create', 'update', 'delete', 'export', 'backup', 'login']
const ENTITIES = ['client', 'document', 'user', 'prospect', 'commissionPayment', 'session', 'data']

export default function AuditoriaPage() {
  const role = useRole()
  const [data, setData] = useState<AuditResponse | null>(null)
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (entity) params.set('entity', entity)
    if (action) params.set('action', action)
    const res = await fetch(`/api/audit?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [page, entity, action])

  useEffect(() => { if (role === 'admin') load() }, [role, load])

  // Reinicia a la página 1 cuando cambian los filtros
  useEffect(() => { setPage(1) }, [entity, action])

  if (role === null) return (
    <div className="flex items-center justify-center h-64"><div className="text-gray-400">Cargando...</div></div>
  )
  if (role !== 'admin') return <AccessDenied />

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-US', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const SELECT = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
  const TH = 'text-xs font-semibold uppercase tracking-wide py-2 px-3 text-left'
  const TD = 'py-2 px-3 text-sm text-gray-800 align-top'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📋 Registro de Auditoría</h1>
          <p className="text-sm text-gray-500 mt-1">Quién hizo qué y cuándo. Aislado a tu agencia.</p>
        </div>
        {data && <p className="text-sm text-gray-500">{data.total} evento(s) registrado(s)</p>}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
          <select value={entity} onChange={e => setEntity(e.target.value)} className={SELECT}>
            <option value="">Todos</option>
            {ENTITIES.map(e => <option key={e} value={e}>{ENTITY_LABEL[e]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Acción</label>
          <select value={action} onChange={e => setAction(e.target.value)} className={SELECT}>
            <option value="">Todas</option>
            {ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABEL[a]?.label || a}</option>)}
          </select>
        </div>
        {(entity || action) && (
          <button onClick={() => { setEntity(''); setAction('') }}
            className="self-end text-xs font-medium px-3 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f8fafc' }}>
                <th className={TH} style={{ color: '#507b88' }}>Fecha y hora</th>
                <th className={TH} style={{ color: '#507b88' }}>Usuario</th>
                <th className={TH} style={{ color: '#507b88' }}>Acción</th>
                <th className={TH} style={{ color: '#507b88' }}>Tipo</th>
                <th className={TH} style={{ color: '#507b88' }}>Detalle</th>
                <th className={TH} style={{ color: '#507b88' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">Cargando...</td></tr>
              ) : !data || data.logs.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No hay eventos para estos filtros.</td></tr>
              ) : data.logs.map(log => {
                const a = ACTION_LABEL[log.action] || { label: log.action, bg: '#f3f4f6', color: '#374151' }
                return (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className={TD + ' whitespace-nowrap text-gray-600'}>{fmtDate(log.createdAt)}</td>
                    <td className={TD}>
                      <div className="font-medium" style={{ color: '#10253f' }}>{log.userName || '—'}</div>
                      {log.userEmail && <div className="text-xs text-gray-400">{log.userEmail}</div>}
                    </td>
                    <td className={TD}>
                      <span className="text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap" style={{ background: a.bg, color: a.color }}>
                        {a.label}
                      </span>
                    </td>
                    <td className={TD + ' text-gray-600'}>{ENTITY_LABEL[log.entity] || log.entity}</td>
                    <td className={TD}>{log.entityLabel || <span className="text-gray-300">—</span>}</td>
                    <td className={TD + ' text-xs text-gray-400 whitespace-nowrap'}>{log.ip || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">Página {data.page} de {data.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
