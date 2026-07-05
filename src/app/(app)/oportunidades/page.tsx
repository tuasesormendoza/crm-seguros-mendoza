'use client'

// Venta Cruzada — clientes activos a los que ofrecer un producto complementario.

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Lead {
  id: string; fullName: string; phone: string | null; email: string | null
  insurer: string | null; state: string | null
}
interface Data { totalActive: number; noDental: Lead[]; noWn: Lead[] }

type ProductKey = 'dental' | 'wn'

const PRODUCTS: Record<ProductKey, {
  label: string; emoji: string; desc: string
  waTemplate: (nombre: string, agente: string) => string
  emailSubject: string
  emailBody: (nombre: string, agente: string) => string
}> = {
  dental: {
    label: 'Plan Dental',
    emoji: '🦷',
    desc: 'Clientes activos sin un plan dental registrado.',
    waTemplate: (n, a) => `Hola ${n}, soy ${a}, tu asesor de seguros. 😊 Además de tu plan de salud, quiero contarte que puedo ofrecerte un *plan dental* con muy buena cobertura (limpiezas, calzas, extracciones) a un precio accesible. ¿Te gustaría que te comparta una cotización sin compromiso?`,
    emailSubject: 'Un plan dental para complementar tu cobertura 🦷',
    emailBody: (n, a) => `Hola ${n},\n\nAdemás de tu seguro de salud, quiero contarte que puedo ofrecerte un plan dental con excelente cobertura y a muy buen precio.\n\nSi te interesa, con gusto te preparo una cotización sin compromiso.\n\nUn saludo,\n${a}\nTu Asesor de Seguros`,
  },
  wn: {
    label: 'Seguro Suplementario',
    emoji: '🏥',
    desc: 'Clientes activos sin un seguro suplementario (hospital/accidente).',
    waTemplate: (n, a) => `Hola ${n}, soy ${a}. 😊 Quiero contarte sobre un *seguro suplementario* que te paga dinero en efectivo directamente a ti si te hospitalizan o tienes un accidente — un complemento ideal a tu plan de salud para cubrir gastos que el seguro médico no paga. ¿Te interesa conocer los detalles?`,
    emailSubject: 'Protección extra en caso de hospitalización 🏥',
    emailBody: (n, a) => `Hola ${n},\n\nQuiero contarte sobre un seguro suplementario que te paga en efectivo directamente a ti si te hospitalizan o tienes un accidente. Es un complemento ideal a tu plan de salud para cubrir gastos que el seguro médico no cubre.\n\nSi te interesa, con gusto te doy los detalles.\n\nUn saludo,\n${a}\nTu Asesor de Seguros`,
  },
}

function waLink(phone: string | null, msg: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const intl = digits.length === 10 ? `1${digits}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
}

function LeadCard({ lead, product, agente }: { lead: Lead; product: ProductKey; agente: string }) {
  const p = PRODUCTS[product]
  const first = lead.fullName.split(' ')[0]
  const wa = waLink(lead.phone, p.waTemplate(first, agente))
  const mail = lead.email
    ? `mailto:${lead.email}?subject=${encodeURIComponent(p.emailSubject)}&body=${encodeURIComponent(p.emailBody(first, agente))}`
    : null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white">
      <div className="min-w-0">
        <Link href={`/clients/${lead.id}`} className="text-sm font-semibold hover:underline" style={{ color: '#10253f' }}>
          {lead.fullName}
        </Link>
        <div className="text-xs text-gray-500 mt-0.5">
          {[lead.insurer, lead.state, lead.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#25d366' }}>
            💬 WhatsApp
          </a>
        )}
        {mail && (
          <a href={mail}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#2a6496' }}>
            📧 Email
          </a>
        )}
        <Link href={`/clients/${lead.id}`}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ color: '#475569', borderColor: '#cbd5e1' }}>
          Ver perfil
        </Link>
      </div>
    </div>
  )
}

export default function OportunidadesPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [agente, setAgente] = useState('Tu Asesor')
  const [tab, setTab] = useState<ProductKey>('dental')

  useEffect(() => {
    fetch('/api/opportunities')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setLoadError(true))
    fetch('/api/settings').then(r => r.json()).then(s => { if (s.agentName) setAgente(s.agentName) }).catch(() => {})
  }, [])

  if (loadError) return <div className="text-center text-gray-400 mt-20">No se pudieron cargar las oportunidades. Recarga la página.</div>
  if (!data) return <div className="text-center text-gray-400 mt-20">Cargando oportunidades...</div>

  const list = tab === 'dental' ? data.noDental : data.noWn
  const product = PRODUCTS[tab]

  const TAB = 'px-4 py-2 text-sm font-semibold rounded-lg transition-colors'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>💡 Oportunidades de Venta Cruzada</h1>
        <p className="text-sm text-gray-500 mt-1">Clientes activos a los que puedes ofrecer un producto complementario que aún no tienen.</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 border" style={{ background: '#f0f7fb', borderColor: '#b8d4e8' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Clientes activos</p>
          <p className="text-2xl font-bold" style={{ color: '#10253f' }}>{data.totalActive}</p>
        </div>
        <button onClick={() => setTab('dental')} className="text-left rounded-xl p-4 border transition-all hover:shadow-md"
          style={{ background: '#fff', borderColor: tab === 'dental' ? '#10253f' : '#e5e7eb' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">🦷 Sin plan dental</p>
          <p className="text-2xl font-bold" style={{ color: '#166534' }}>{data.noDental.length}</p>
          <p className="text-xs text-gray-400 mt-1">oportunidades de venta</p>
        </button>
        <button onClick={() => setTab('wn')} className="text-left rounded-xl p-4 border transition-all hover:shadow-md"
          style={{ background: '#fff', borderColor: tab === 'wn' ? '#10253f' : '#e5e7eb' }}>
          <p className="text-xs font-medium text-gray-600 mb-1">🏥 Sin seguro suplementario</p>
          <p className="text-2xl font-bold" style={{ color: '#166534' }}>{data.noWn.length}</p>
          <p className="text-xs text-gray-400 mt-1">oportunidades de venta</p>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(Object.keys(PRODUCTS) as ProductKey[]).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className={TAB}
            style={tab === k ? { background: '#10253f', color: '#fff' } : { color: '#475569' }}>
            {PRODUCTS[k].emoji} {PRODUCTS[k].label} ({(k === 'dental' ? data.noDental : data.noWn).length})
          </button>
        ))}
      </div>

      {/* Lista */}
      <div>
        <p className="text-sm text-gray-500 mb-3">{product.desc}</p>
        {list.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-gray-200">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm text-gray-500">¡Todos tus clientes activos ya tienen {product.label.toLowerCase()}!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map(lead => <LeadCard key={lead.id} lead={lead} product={tab} agente={agente} />)}
          </div>
        )}
      </div>
    </div>
  )
}
