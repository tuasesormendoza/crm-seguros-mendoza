'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Prospect {
  id: string; fullName: string; phone: string | null; stage: string; createdAt: string
}

interface Referrer {
  clientId: string; clientName: string; clientPhone: string | null; clientEmail: string | null
  totalReferrals: number; converted: number; pending: number; lost: number
  conversionRate: number; lastReferralDate: string; prospects: Prospect[]
}

function fmt(date: string) {
  try { return new Date(date).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return date }
}

const RANK_BADGES = ['🥇', '🥈', '🥉']

function ReferrerRow({ referrer, rank }: { referrer: Referrer; rank: number }) {
  const [expanded, setExpanded] = useState(false)

  const firstName = referrer.clientName.split(' ')[0]

  function sendWhatsApp() {
    if (!referrer.clientPhone) return
    const digits = referrer.clientPhone.replace(/\D/g, '')
    const intl = digits.length === 10 ? `1${digits}` : digits
    const msg = `Hola ${firstName}, ha sido un gusto acompañarte cuidando lo que más importa: tu salud y la de tu familia. Si conoces a alguien que valore una asesoría honesta y sin compromiso sobre sus seguros, sería un honor ayudarle igual que a ti. ¡Un abrazo! 🙏\n\n— Omar Mendoza, Tu Asesor de Seguros`
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function sendEmail() {
    if (!referrer.clientEmail) return
    const subject = 'Gracias por tu confianza 🙏'
    const body = `Hola ${firstName},\n\nHa sido un verdadero gusto acompañarte asegurando lo que más importa para ti y tu familia.\n\nSi tienes algún familiar, amigo o compañero de trabajo que valore una asesoría honesta, clara y sin compromiso sobre sus seguros, sería un honor poder ayudarle con la misma dedicación que a ti.\n\n¡Un fuerte abrazo!\n\nOmar Mendoza\nTu Asesor de Seguros`
    window.location.href = `mailto:${referrer.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-center">
          <span className="text-lg">{rank <= 2 ? RANK_BADGES[rank] : <span className="text-xs font-bold text-gray-500">#{rank + 1}</span>}</span>
        </td>
        <td className="px-4 py-3">
          <Link href={`/clients/${referrer.clientId}`} className="text-sm font-semibold hover:underline" style={{ color: '#10253f' }}>
            {referrer.clientName}
          </Link>
          {referrer.clientPhone && <div className="text-xs text-gray-500 mt-0.5">{referrer.clientPhone}</div>}
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm font-bold" style={{ color: '#10253f' }}>{referrer.totalReferrals}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#d1fae5', color: '#065f46' }}>{referrer.converted}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>{referrer.pending}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9', minWidth: 60 }}>
              <div className="h-full rounded-full" style={{ width: `${referrer.conversionRate}%`, background: referrer.conversionRate >= 50 ? '#10b981' : '#f59e0b' }} />
            </div>
            <span className="text-xs font-semibold w-8" style={{ color: referrer.conversionRate >= 50 ? '#065f46' : '#92400e' }}>{referrer.conversionRate}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{fmt(referrer.lastReferralDate)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {referrer.clientPhone && (
              <button onClick={sendWhatsApp}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#25d366' }}>
                💬 Agradecer
              </button>
            )}
            {referrer.clientEmail && (
              <button onClick={sendEmail}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ background: '#2a6496' }}>
                📧 Email
              </button>
            )}
            <button onClick={() => setExpanded(v => !v)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-100"
              style={{ border: '1px solid #cbd5e1', color: '#475569' }}>
              {expanded ? '▲ Ocultar' : '👁 Ver prospectos'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-4 py-0">
            <div className="pb-3">
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                {referrer.prospects.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0" style={{ background: '#f8fafc' }}>
                    <div>
                      <div className="text-sm font-medium" style={{ color: '#0f172a' }}>{p.fullName}</div>
                      <div className="text-xs text-gray-500">{p.phone || 'Sin teléfono'} · Referido {fmt(p.createdAt)}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={p.stage === 'Cerrado - Ganado'
                        ? { background: '#d1fae5', color: '#065f46' }
                        : p.stage === 'Cerrado - Perdido'
                          ? { background: '#fee2e2', color: '#991b1b' }
                          : { background: '#fef3c7', color: '#92400e' }}>
                      {p.stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function ReferidosPage() {
  const [referrers, setReferrers] = useState<Referrer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/referrals').then(r => r.json()).then(d => {
      setReferrers(d.referrers || [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando referidos...</div>
    </div>
  )

  const totalReferrers = referrers.length
  const totalReferrals = referrers.reduce((s, r) => s + r.totalReferrals, 0)
  const best = referrers[0] || null
  const avgConversion = totalReferrers > 0 ? Math.round(referrers.reduce((s, r) => s + r.conversionRate, 0) / totalReferrers) : 0

  function broadcastWhatsApp() {
    const msg = 'Hola, ha sido un gusto acompañarte cuidando lo que más importa: tu salud y la de tu familia. Si conoces a alguien que valore una asesoría honesta y sin compromiso sobre sus seguros, sería un honor ayudarle igual que a ti. ¡Un abrazo! 🙏\n\n— Omar Mendoza, Tu Asesor de Seguros'
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#10253f' }}>🤝 Dashboard de Referidos</h1>
          <p className="text-sm text-gray-500 mt-1">Clientes que han referido prospectos a tu agencia</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Clientes que refirieron', value: totalReferrers, icon: '👥', color: '#10253f', bg: '#e8f2f8' },
          { label: 'Total prospectos referidos', value: totalReferrals, icon: '🔗', color: '#2a6496', bg: '#dbeafe' },
          { label: 'Mejor referidor', value: best ? best.clientName.split(' ')[0] + ' (' + best.totalReferrals + ')' : '—', icon: '🥇', color: '#d97706', bg: '#fef3c7' },
          { label: 'Tasa de conversión promedio', value: `${avgConversion}%`, icon: '📈', color: '#059669', bg: '#d1fae5' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderTop: `3px solid ${card.color}` }}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-2xl font-extrabold leading-none truncate" style={{ color: '#0f172a' }}>{card.value}</div>
                <div className="text-xs font-medium mt-1.5 text-gray-500">{card.label}</div>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: card.bg }}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table or empty state */}
      {referrers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">🤝</div>
          <h3 className="font-bold text-lg text-gray-700 mb-2">¡Aún no hay referidos!</h3>
          <p className="text-sm text-gray-500 mb-6">Motiva a tus clientes a referir amigos y familiares que necesiten seguro de salud.</p>
          <button onClick={broadcastWhatsApp}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-semibold transition-all hover:opacity-90"
            style={{ background: '#25d366' }}>
            💬 Enviar mensaje a clientes
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-sm" style={{ color: '#10253f' }}>Top Referidores</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center w-12">#</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Cliente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Referidos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Convertidos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-center">Pendientes</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Tasa conv.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Último</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {referrers.map((r, i) => (
                  <ReferrerRow key={r.clientId} referrer={r} rank={i} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
