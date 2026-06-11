'use client'

import { useEffect, useState } from 'react'
import { useRole } from '@/hooks/useRole'
import AccessDenied from '@/components/AccessDenied'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string; fullName: string; email?: string | null; phone?: string | null
  insurer?: string | null; planName?: string | null; planCategory?: string | null
  totalMonthly?: number | null; acaPrice?: number | null; wnPolicies?: string | null
  status?: string | null; renewalDate?: string | null; contractDate?: string | null
  affiliatesCount?: number | null; state?: string | null; coverageType?: string | null
  birthDate?: string | null; city?: string | null; county?: string | null
  firstPaymentPaid?: boolean | null; firstPaymentDate?: string | null
  tags?: string | null; policyYear?: number | null
}

interface DashboardData {
  totalPolicies: number; activeClients: number; cancelledClients: number
  totalLives: number; totalMonthly: number; withWN: number
  byInsurer: Record<string, number>; byState: Record<string, number>
  byCoverage: Record<string, number>
  pendingFirstPayment: { id: string; fullName: string; contractDate: string; daysElapsed: number; insurer: string | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (v?: number | null) =>
  v == null ? '$0.00' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

const fmtDate = (v?: string | null) => {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()}`
  } catch { return '—' }
}

const fmtAge = (v?: string | null) => {
  if (!v) return '—'
  const d = new Date(v)
  const today = new Date()
  let age = today.getFullYear() - d.getUTCFullYear()
  if (today.getMonth() < d.getUTCMonth() || (today.getMonth() === d.getUTCMonth() && today.getDate() < d.getUTCDate())) age--
  return `${age} años`
}

const CAT_COLOR: Record<string, string> = {
  Gold: '#b45309', Silver: '#64748b', Bronze: '#b45309', Platinum: '#1d4ed8',
}
const CAT_BG: Record<string, string> = {
  Gold: '#fef3c7', Silver: '#f1f5f9', Bronze: '#ffedd5', Platinum: '#dbeafe',
}

const STATUS_COLOR: Record<string, string> = {
  Activo: '#166534', Cancelado: '#991b1b', 'Pendiente de Pago': '#92400e', Renovado: '#1e40af', 'En Proceso': '#5b21b6',
}
const STATUS_BG: Record<string, string> = {
  Activo: '#dcfce7', Cancelado: '#fee2e2', 'Pendiente de Pago': '#fef3c7', Renovado: '#dbeafe', 'En Proceso': '#ede9fe',
}

// ─── Report types config ──────────────────────────────────────────────────────

const REPORT_TYPES = [
  { id: 'portfolio',    icon: '📊', label: 'Cartera Completa',       desc: 'KPIs, por aseguradora, estados, cobertura y lista de clientes' },
  { id: 'renewals',     icon: '🔄', label: 'Renovaciones',            desc: 'Clientes ordenados por fecha de renovación próxima' },
  { id: 'commissions',  icon: '💰', label: 'Comisiones',              desc: 'Producción mensual y anual por aseguradora' },
  { id: 'firstpayment', icon: '⚠️', label: 'Primer Pago Pendiente',   desc: 'Clientes sin confirmar pago de primera prima' },
  { id: 'byinsurer',    icon: '🏥', label: 'Por Aseguradora',         desc: 'Reporte filtrado por aseguradora específica' },
  { id: 'bystate',      icon: '📍', label: 'Por Estado',              desc: 'Reporte filtrado por estado/ubicación' },
  { id: 'directory',    icon: '📋', label: 'Directorio de Clientes',  desc: 'Lista con datos de contacto completos' },
]

const WN_PCT = 25

// ─── Sub-components ───────────────────────────────────────────────────────────

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wide border-b-2 ${right ? 'text-right' : 'text-left'}`}
      style={{ borderColor: '#10253f', color: '#10253f', background: '#f0f5f7' }}>
      {children}
    </th>
  )
}

function TD({ children, right, center, bold }: { children: React.ReactNode; right?: boolean; center?: boolean; bold?: boolean }) {
  return (
    <td className={`px-3 py-2 text-sm border-b ${right ? 'text-right' : center ? 'text-center' : ''} ${bold ? 'font-semibold' : ''}`}
      style={{ borderColor: '#e5e7eb', color: bold ? '#10253f' : '#374151' }}>
      {children}
    </td>
  )
}

function CatBadge({ cat }: { cat?: string | null }) {
  if (!cat) return <span className="text-gray-400">—</span>
  return (
    <span className="px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: CAT_BG[cat] || '#f1f5f9', color: CAT_COLOR[cat] || '#374151' }}>
      {cat}
    </span>
  )
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>
  return (
    <span className="px-2 py-0.5 rounded text-xs font-bold"
      style={{ background: STATUS_BG[status] || '#f1f5f9', color: STATUS_COLOR[status] || '#374151' }}>
      {status}
    </span>
  )
}

function ReportHeader({ title, subtitle, agentName, date }: { title: string; subtitle: string; agentName: string; date: string }) {
  return (
    <div style={{ borderBottom: '3px solid #10253f', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10253f' }}>CRM Agentes de Seguros</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#305a72', marginTop: 2 }}>{title}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10253f' }}>{agentName}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Agente de Seguros</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>{date}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Report content components ────────────────────────────────────────────────

function PortfolioReport({ clients, dash, agentName, date, sections }: {
  clients: Client[]; dash: DashboardData; agentName: string; date: string; sections: Record<string, boolean>
}) {
  const insurerData: Record<string, { policies: number; lives: number; monthly: number }> = {}
  clients.forEach(c => {
    if (!c.insurer) return
    if (!insurerData[c.insurer]) insurerData[c.insurer] = { policies: 0, lives: 0, monthly: 0 }
    insurerData[c.insurer].policies++
    insurerData[c.insurer].lives += c.affiliatesCount || 1
    insurerData[c.insurer].monthly += c.totalMonthly || 0
  })
  const totalMonthly = clients.reduce((s, c) => s + (c.totalMonthly || 0), 0)

  return (
    <div>
      <ReportHeader title="Reporte de Cartera" subtitle={`${clients.length} pólizas activas`} agentName={agentName} date={date} />

      {sections.kpis && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10253f', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen General</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Total Pólizas', value: dash.totalPolicies },
              { label: 'Clientes Activos', value: dash.activeClients },
              { label: 'Vidas Aseguradas', value: dash.totalLives },
              { label: 'Prima Mensual Total', value: fmt$(totalMonthly) },
            ].map(k => (
              <div key={k.label} style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '12px', textAlign: 'center', borderTop: '3px solid #10253f' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10253f' }}>{k.value}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.byInsurer && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10253f', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por Aseguradora</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><TH>Aseguradora</TH><TH>Pólizas</TH><TH>Vidas</TH><TH right>Prima Mensual</TH><TH right>Anual Est.</TH></tr></thead>
            <tbody>
              {Object.entries(insurerData).sort((a, b) => b[1].monthly - a[1].monthly).map(([name, d], i) => (
                <tr key={name} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <TD bold>{name}</TD><TD center>{d.policies}</TD><TD center>{d.lives}</TD>
                  <TD right>{fmt$(d.monthly)}</TD><TD right>{fmt$(d.monthly * 12)}</TD>
                </tr>
              ))}
              <tr style={{ background: '#f0f5f7' }}>
                <TD bold>TOTAL</TD><TD center bold>{Object.values(insurerData).reduce((s,d)=>s+d.policies,0)}</TD>
                <TD center bold>{Object.values(insurerData).reduce((s,d)=>s+d.lives,0)}</TD>
                <TD right bold>{fmt$(totalMonthly)}</TD><TD right bold>{fmt$(totalMonthly*12)}</TD>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {sections.byState && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10253f', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por Estado</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><TH>Estado</TH><TH>Pólizas</TH><TH>%</TH></tr></thead>
              <tbody>
                {Object.entries(dash.byState).sort((a,b)=>b[1]-a[1]).map(([state,n],i)=>(
                  <tr key={state} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                    <TD bold>{state}</TD><TD center>{n}</TD>
                    <TD center>{((n/dash.totalPolicies)*100).toFixed(1)}%</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10253f', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Por Tipo de Cobertura</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><TH>Cobertura</TH><TH>Pólizas</TH><TH>%</TH></tr></thead>
              <tbody>
                {Object.entries(dash.byCoverage).sort((a,b)=>b[1]-a[1]).map(([cov,n],i)=>(
                  <tr key={cov} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                    <TD bold>{cov}</TD><TD center>{n}</TD>
                    <TD center>{((n/dash.totalPolicies)*100).toFixed(1)}%</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sections.clientList && (
        <div style={{ pageBreakBefore: 'always' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10253f', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Lista de Clientes ({clients.length})
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr>
                <TH>#</TH><TH>Nombre</TH><TH>Aseguradora</TH><TH>Plan</TH>
                <TH right>Total/mes</TH><TH>Estatus</TH><TH>Renovación</TH>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} style={{ background: i%2===0?'#fff':'#f8fafc', pageBreakInside: 'avoid' }}>
                  <TD>{i+1}</TD>
                  <TD bold>{c.fullName}</TD>
                  <TD>{c.insurer||'—'}</TD>
                  <TD><CatBadge cat={c.planCategory} /></TD>
                  <TD right bold>{fmt$(c.totalMonthly)}</TD>
                  <TD><StatusBadge status={c.status} /></TD>
                  <TD>{fmtDate(c.renewalDate)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RenewalsReport({ clients, agentName, date, months }: { clients: Client[]; agentName: string; date: string; months: number }) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() + months)
  const filtered = clients
    .filter(c => c.renewalDate && new Date(c.renewalDate) <= cutoff && new Date(c.renewalDate) >= new Date())
    .sort((a, b) => new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime())

  return (
    <div>
      <ReportHeader title="Reporte de Renovaciones" subtitle={`Próximos ${months} meses — ${filtered.length} clientes`} agentName={agentName} date={date} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead><tr><TH>#</TH><TH>Nombre</TH><TH>Teléfono</TH><TH>Aseguradora</TH><TH>Plan</TH><TH right>Total/mes</TH><TH>Renovación</TH><TH>Estado</TH></tr></thead>
        <tbody>
          {filtered.map((c, i) => (
            <tr key={c.id} style={{ background: i%2===0?'#fff':'#f8fafc', pageBreakInside: 'avoid' }}>
              <TD>{i+1}</TD><TD bold>{c.fullName}</TD><TD>{c.phone||'—'}</TD><TD>{c.insurer||'—'}</TD>
              <TD><CatBadge cat={c.planCategory} /></TD><TD right bold>{fmt$(c.totalMonthly)}</TD>
              <TD bold>{fmtDate(c.renewalDate)}</TD><TD>{c.state||'—'}</TD>
            </tr>
          ))}
          {filtered.length === 0 && <tr><TD center>Sin renovaciones en este período</TD></tr>}
        </tbody>
      </table>
    </div>
  )
}

function CommissionsReport({ clients, agentName, date }: { clients: Client[]; agentName: string; date: string }) {
  const insurerMap: Record<string, { policies: number; lives: number; monthly: number; wnMonthly: number }> = {}
  clients.forEach(c => {
    if (!c.insurer) return
    if (!insurerMap[c.insurer]) insurerMap[c.insurer] = { policies: 0, lives: 0, monthly: 0, wnMonthly: 0 }
    insurerMap[c.insurer].policies++
    insurerMap[c.insurer].lives += c.affiliatesCount || 1
    // ACA commission: $18 PMPM * lives
    insurerMap[c.insurer].monthly += 18 * (c.affiliatesCount || 1)
    // WN commission: 25% of WN premium
    if (c.wnPolicies) {
      try {
        const wn = JSON.parse(c.wnPolicies)
        if (Array.isArray(wn)) {
          const wnTotal = wn.reduce((s: number, p: { monthly?: number }) => s + (p.monthly || 0), 0)
          insurerMap[c.insurer].wnMonthly += wnTotal * (WN_PCT / 100)
        }
      } catch {}
    }
  })
  const totalACA = Object.values(insurerMap).reduce((s,d)=>s+d.monthly,0)
  const totalWN = Object.values(insurerMap).reduce((s,d)=>s+d.wnMonthly,0)

  return (
    <div>
      <ReportHeader title="Reporte de Comisiones" subtitle="Estimado basado en $18 PMPM (ACA) + 25% WN" agentName={agentName} date={date} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead><tr><TH>Aseguradora</TH><TH>Pólizas</TH><TH>Vidas</TH><TH right>Com. ACA/mes</TH><TH right>Com. WN/mes</TH><TH right>Total/mes</TH><TH right>Total/año</TH></tr></thead>
        <tbody>
          {Object.entries(insurerMap).sort((a,b)=>b[1].monthly-a[1].monthly).map(([name,d],i)=>(
            <tr key={name} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
              <TD bold>{name}</TD><TD center>{d.policies}</TD><TD center>{d.lives}</TD>
              <TD right>{fmt$(d.monthly)}</TD><TD right>{fmt$(d.wnMonthly)}</TD>
              <TD right bold>{fmt$(d.monthly+d.wnMonthly)}</TD>
              <TD right bold>{fmt$((d.monthly+d.wnMonthly)*12)}</TD>
            </tr>
          ))}
          <tr style={{ background: '#f0f5f7' }}>
            <TD bold>TOTAL</TD>
            <TD center bold>{Object.values(insurerMap).reduce((s,d)=>s+d.policies,0)}</TD>
            <TD center bold>{Object.values(insurerMap).reduce((s,d)=>s+d.lives,0)}</TD>
            <TD right bold>{fmt$(totalACA)}</TD><TD right bold>{fmt$(totalWN)}</TD>
            <TD right bold>{fmt$(totalACA+totalWN)}</TD>
            <TD right bold>{fmt$((totalACA+totalWN)*12)}</TD>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
        * Estimado. Tasas reales varían por aseguradora. ACA: $18/miembro/mes · WN: 25% de prima mensual.
      </p>
    </div>
  )
}

function FirstPaymentReport({ clients, agentName, date }: { clients: Client[]; agentName: string; date: string }) {
  const pending = clients.filter(c => !c.firstPaymentPaid && c.contractDate)
    .map(c => ({ ...c, days: Math.floor((new Date().getTime() - new Date(c.contractDate!).getTime()) / (1000*60*60*24)) }))
    .sort((a,b) => b.days - a.days)

  return (
    <div>
      <ReportHeader title="Primer Pago Pendiente" subtitle={`${pending.length} clientes sin confirmar primera prima`} agentName={agentName} date={date} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead><tr><TH>#</TH><TH>Nombre</TH><TH>Teléfono</TH><TH>Aseguradora</TH><TH>Contratación</TH><TH>Días</TH><TH right>Total/mes</TH><TH>Estatus</TH></tr></thead>
        <tbody>
          {pending.map((c, i) => (
            <tr key={c.id} style={{ background: c.days > 30 ? '#fff5f5' : i%2===0?'#fff':'#f8fafc', pageBreakInside: 'avoid' }}>
              <TD>{i+1}</TD><TD bold>{c.fullName}</TD><TD>{c.phone||'—'}</TD><TD>{c.insurer||'—'}</TD>
              <TD>{fmtDate(c.contractDate)}</TD>
              <TD center bold><span style={{ color: c.days > 30 ? '#dc2626' : '#d97706' }}>{c.days}d</span></TD>
              <TD right>{fmt$(c.totalMonthly)}</TD>
              <TD><StatusBadge status={c.status} /></TD>
            </tr>
          ))}
          {pending.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', padding:'2rem', color:'#94a3b8', fontSize:'0.85rem' }}>✓ Todos los clientes tienen su primer pago confirmado</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function DirectoryReport({ clients, agentName, date }: { clients: Client[]; agentName: string; date: string }) {
  return (
    <div>
      <ReportHeader title="Directorio de Clientes" subtitle={`${clients.length} clientes · Información de contacto`} agentName={agentName} date={date} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead><tr><TH>#</TH><TH>Nombre</TH><TH>Teléfono</TH><TH>Email</TH><TH>Ciudad</TH><TH>Estado</TH><TH>Aseguradora</TH><TH>Renovación</TH></tr></thead>
        <tbody>
          {clients.map((c, i) => (
            <tr key={c.id} style={{ background: i%2===0?'#fff':'#f8fafc', pageBreakInside: 'avoid' }}>
              <TD>{i+1}</TD><TD bold>{c.fullName}</TD><TD>{c.phone||'—'}</TD>
              <TD>{c.email||'—'}</TD><TD>{c.city||'—'}</TD><TD>{c.state||'—'}</TD>
              <TD>{c.insurer||'—'}</TD><TD>{fmtDate(c.renewalDate)}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FilteredReport({ clients, dash, agentName, date, filterBy, filterValue }: {
  clients: Client[]; dash: DashboardData; agentName: string; date: string
  filterBy: 'insurer' | 'state'; filterValue: string
}) {
  const filtered = clients.filter(c => filterBy === 'insurer' ? c.insurer === filterValue : c.state === filterValue)
  const total = filtered.reduce((s,c)=>s+(c.totalMonthly||0),0)
  const label = filterBy === 'insurer' ? 'Aseguradora' : 'Estado'

  return (
    <div>
      <ReportHeader title={`Reporte por ${label}: ${filterValue}`}
        subtitle={`${filtered.length} clientes · Prima mensual: ${fmt$(total)}`}
        agentName={agentName} date={date} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
        <thead><tr><TH>#</TH><TH>Nombre</TH><TH>Teléfono</TH><TH>Plan</TH><TH>Cobertura</TH><TH right>Total/mes</TH><TH>Estatus</TH><TH>Renovación</TH></tr></thead>
        <tbody>
          {filtered.map((c, i) => (
            <tr key={c.id} style={{ background: i%2===0?'#fff':'#f8fafc', pageBreakInside: 'avoid' }}>
              <TD>{i+1}</TD><TD bold>{c.fullName}</TD><TD>{c.phone||'—'}</TD>
              <TD><CatBadge cat={c.planCategory} /></TD><TD>{c.coverageType||'—'}</TD>
              <TD right bold>{fmt$(c.totalMonthly)}</TD>
              <TD><StatusBadge status={c.status} /></TD><TD>{fmtDate(c.renewalDate)}</TD>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', padding:'2rem', color:'#94a3b8' }}>Sin clientes para este filtro</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [dash, setDash] = useState<DashboardData | null>(null)
  const [agentName, setAgentName] = useState('Omar Mendoza')
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('portfolio')
  const [renewalMonths, setRenewalMonths] = useState(3)
  const [filterInsurer, setFilterInsurer] = useState('')
  const [filterState, setFilterState] = useState('')
  const [sections, setSections] = useState({
    kpis: true, byInsurer: true, byState: true, clientList: true,
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([c, d, s]) => {
      setClients(c); setDash(d)
      if (s?.agentName) setAgentName(s.agentName)
      setLoading(false)
    })
  }, [])

  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const insurers = [...new Set(clients.map(c => c.insurer).filter(Boolean) as string[])].sort()
  const states   = [...new Set(clients.map(c => c.state).filter(Boolean) as string[])].sort()

  const role = useRole()
  if (role === null) return (
    <div className="flex items-center justify-center h-64">
      <div style={{ color: '#94a3b8' }}>Generando reporte...</div>
    </div>
  )
  if (role === 'assistant') return <AccessDenied />

  if (loading || !dash) return (
    <div className="flex items-center justify-center h-64">
      <div style={{ color: '#94a3b8' }}>Generando reporte...</div>
    </div>
  )

  const BTN = 'px-4 py-2 rounded-lg text-sm font-semibold transition-all'

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          aside, nav { display: none !important; }
          main { overflow: visible !important; padding: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          .report-page { padding: 1cm !important; margin: 0 !important; max-width: 100% !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
          @page { size: A4 landscape; margin: 1.5cm; }
          tr { page-break-inside: avoid; }
          table { page-break-inside: auto; }
          h2, .section-title { page-break-after: avoid; }
        }
      `}</style>

      {/* ── Controls bar — hidden on print ── */}
      <div className="no-print space-y-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>📊 Reportes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Selecciona el tipo y configura las opciones antes de imprimir</p>
          </div>
          <button onClick={() => window.print()}
            className={BTN + ' text-white'}
            style={{ background: 'linear-gradient(135deg, #2a6496, #0891b2)', boxShadow: '0 2px 8px rgba(42,100,150,.3)' }}>
            🖨️ Imprimir / Exportar PDF
          </button>
        </div>

        {/* Report type selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tipo de Reporte</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {REPORT_TYPES.map(r => (
              <button key={r.id} onClick={() => setActiveReport(r.id)}
                className="text-left p-3 rounded-xl border-2 transition-all"
                style={{
                  borderColor: activeReport === r.id ? '#2a6496' : '#e2e8f0',
                  background: activeReport === r.id ? '#f0f7fb' : '#fff',
                }}>
                <div className="text-lg mb-1">{r.icon}</div>
                <div className="text-xs font-bold" style={{ color: '#10253f' }}>{r.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Options panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Opciones</p>
          <div className="flex flex-wrap gap-4 items-end">

            {/* Portfolio sections */}
            {activeReport === 'portfolio' && (
              <div className="flex gap-3 flex-wrap">
                {[
                  { key: 'kpis', label: 'KPIs' },
                  { key: 'byInsurer', label: 'Por Aseguradora' },
                  { key: 'byState', label: 'Por Estado' },
                  { key: 'clientList', label: 'Lista de Clientes' },
                ].map(s => (
                  <label key={s.key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={sections[s.key as keyof typeof sections]}
                      onChange={e => setSections(prev => ({ ...prev, [s.key]: e.target.checked }))}
                      className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium text-gray-700">{s.label}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Renewals months */}
            {activeReport === 'renewals' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Próximos</label>
                <select value={renewalMonths} onChange={e => setRenewalMonths(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  <option value={1}>1 mes</option>
                  <option value={2}>2 meses</option>
                  <option value={3}>3 meses</option>
                  <option value={6}>6 meses</option>
                  <option value={12}>12 meses</option>
                </select>
              </div>
            )}

            {/* By Insurer filter */}
            {activeReport === 'byinsurer' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora</label>
                <select value={filterInsurer} onChange={e => setFilterInsurer(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-48">
                  <option value="">Seleccionar...</option>
                  {insurers.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
            )}

            {/* By State filter */}
            {activeReport === 'bystate' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select value={filterState} onChange={e => setFilterState(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-48">
                  <option value="">Seleccionar...</option>
                  {states.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Report Content (printed) ── */}
      <div className="report-page bg-white rounded-xl border border-gray-200 p-8 max-w-6xl mx-auto">
        {activeReport === 'portfolio' && <PortfolioReport clients={clients} dash={dash} agentName={agentName} date={date} sections={sections} />}
        {activeReport === 'renewals' && <RenewalsReport clients={clients} agentName={agentName} date={date} months={renewalMonths} />}
        {activeReport === 'commissions' && <CommissionsReport clients={clients} agentName={agentName} date={date} />}
        {activeReport === 'firstpayment' && <FirstPaymentReport clients={clients} agentName={agentName} date={date} />}
        {activeReport === 'directory' && <DirectoryReport clients={clients} agentName={agentName} date={date} />}
        {activeReport === 'byinsurer' && filterInsurer && <FilteredReport clients={clients} dash={dash} agentName={agentName} date={date} filterBy="insurer" filterValue={filterInsurer} />}
        {activeReport === 'bystate' && filterState && <FilteredReport clients={clients} dash={dash} agentName={agentName} date={date} filterBy="state" filterValue={filterState} />}
        {(activeReport === 'byinsurer' && !filterInsurer) || (activeReport === 'bystate' && !filterState) ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Selecciona un filtro para ver el reporte</div>
        ) : null}

        {/* Footer */}
        <div style={{ marginTop: '2rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
          <span>CRM Agentes de Seguros · Confidencial</span>
          <span>{agentName} · {date}</span>
        </div>
      </div>
    </>
  )
}
