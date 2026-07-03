'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import LoadError from '@/components/LoadError'

interface TodayData {
  todayAppointments: { id: string; date: string; notes: string | null; status: string; clientId: string; clientName: string }[]
  urgentRenewals: { id: string; fullName: string; insurer: string | null; renewalDate: string; daysUntil: number }[]
  weekBirthdays: { id: string; fullName: string; birthDate: string; age: number; daysUntil: number; phone?: string | null }[]
  unpaidFirstPremium: { id: string; fullName: string; contractDate: string; daysElapsed: number }[]
  pendingFollowUp: { id: string; fullName: string }[]
}

function Section({ title, count, children, defaultOpen = true }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-base" style={{ color: '#10253f' }}>{title}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${count === 0 ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'}`}>
            {count}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-400 italic pt-4">{msg}</p>
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null)
  const [birthdayTemplate, setBirthdayTemplate] = useState('Hola {nombre}, ¡feliz cumpleaños! 🎂🎉 Que tengas un día muy especial. Con cariño, {agente}')
  const [agentName, setAgentName] = useState('Omar Mendoza')
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    fetch('/api/today')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch(() => setLoadError(true))
    // Datos secundarios: si fallan, se usan la plantilla y el nombre por defecto
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.birthdayTemplate) setBirthdayTemplate(s.birthdayTemplate)
      if (s.agentName) setAgentName(s.agentName)
    }).catch(() => {})
  }, [])

  const today = new Date()
  const weekday = today.toLocaleDateString('es-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' })

  if (!data && loadError) return <LoadError message="No se pudo cargar la agenda de hoy" />

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400">Cargando...</div>
    </div>
  )

  const totalItems = data.todayAppointments.length + data.urgentRenewals.length +
    data.weekBirthdays.length + data.unpaidFirstPremium.length + data.pendingFollowUp.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold capitalize" style={{ color: '#10253f' }}>
            📋 ¿Qué hacer hoy?
          </h1>
          <p className="text-gray-500 text-sm mt-1 capitalize">{weekday}, {dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalItems > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {totalItems} pendiente{totalItems !== 1 ? 's' : ''}
            </span>
          )}
          <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">← Dashboard</Link>
        </div>
      </div>

      {/* 1. Today's appointments */}
      <Section title="📅 Citas de hoy" count={data.todayAppointments.length}>
        {data.todayAppointments.length === 0 ? (
          <EmptyState msg="Sin citas programadas para hoy" />
        ) : (
          <div className="space-y-2 pt-4">
            {data.todayAppointments.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900 text-sm">
                    {new Date(a.date).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' })} — {a.clientName}
                  </div>
                  {a.notes && <div className="text-xs text-gray-500 mt-0.5">{a.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{a.status}</span>
                  <Link href={`/clients/${a.clientId}`} className="text-xs font-semibold text-blue-600 hover:underline">Ver →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Urgent renewals */}
      <Section title="🔄 Renovaciones urgentes (≤14 días)" count={data.urgentRenewals.length}>
        {data.urgentRenewals.length === 0 ? (
          <EmptyState msg="Sin renovaciones urgentes esta semana" />
        ) : (
          <div className="space-y-2 pt-4">
            {data.urgentRenewals.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-yellow-100 bg-yellow-50">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.fullName}</div>
                  <div className="text-xs text-gray-500">{c.insurer} · {new Date(c.renewalDate).toLocaleDateString('es-US')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.daysUntil <= 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {c.daysUntil === 0 ? 'Hoy' : `${c.daysUntil}d`}
                  </span>
                  <Link href={`/clients/${c.id}`} className="text-xs font-semibold text-blue-600 hover:underline">Ver cliente →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 3. Birthdays */}
      <Section title="🎂 Cumpleaños esta semana" count={data.weekBirthdays.length}>
        {data.weekBirthdays.length === 0 ? (
          <EmptyState msg="Sin cumpleaños esta semana" />
        ) : (
          <div className="space-y-2 pt-4">
            {data.weekBirthdays.map(c => {
              const isToday = c.daysUntil === 0
              const waMsg = birthdayTemplate
                .replace(/\{nombre\}/g, c.fullName.split(' ')[0])
                .replace(/\{agente\}/g, agentName)
              const digits = (c.phone || '').replace(/\D/g, '')
              const intl = digits.length === 10 ? `1${digits}` : digits
              const waUrl = intl ? `https://wa.me/${intl}?text=${encodeURIComponent(waMsg)}` : ''
              return (
                <div key={c.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: isToday ? '#fff0f6' : '#fdf2f8',
                    border: `1.5px solid ${isToday ? '#f9a8d4' : '#fce7f3'}`,
                  }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: isToday ? '#be185d' : '#374151' }}>
                      {isToday && '🎉 '}{c.fullName}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(c.birthDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · {c.age} años
                      {isToday && <span className="ml-2 font-bold text-pink-600">¡Hoy es su cumpleaños!</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {waUrl && (
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                        style={{ background: '#25d366' }}>
                        💬 {isToday ? '¡Felicitar!' : 'Felicitar'}
                      </a>
                    )}
                    <Link href={`/clients/${c.id}`}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ color: '#2a6496', background: '#f0f7fb' }}>
                      Ver →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* 4. Unpaid first premium */}
      <Section title="⚠️ Primer pago pendiente" count={data.unpaidFirstPremium.length}>
        {data.unpaidFirstPremium.length === 0 ? (
          <EmptyState msg="Sin clientes con primer pago pendiente" />
        ) : (
          <div className="space-y-2 pt-4">
            {data.unpaidFirstPremium.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-100 bg-orange-50">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{c.fullName}</div>
                  <div className="text-xs text-gray-500">Contratado: {new Date(c.contractDate).toLocaleDateString('es-US')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.daysElapsed > 30 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {c.daysElapsed > 30 ? 'Vencido' : `${c.daysElapsed}d`}
                  </span>
                  <Link href={`/clients/${c.id}`} className="text-xs font-semibold text-blue-600 hover:underline">Ver cliente →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 5. Pending follow-up */}
      <Section title="💤 Sin actividad reciente / Seguimiento" count={data.pendingFollowUp.length} defaultOpen={false}>
        {data.pendingFollowUp.length === 0 ? (
          <EmptyState msg="Todos los clientes tienen actividad reciente" />
        ) : (
          <div className="space-y-2 pt-4">
            {data.pendingFollowUp.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div className="font-medium text-gray-900 text-sm">{c.fullName}</div>
                <Link href={`/clients/${c.id}`} className="text-xs font-semibold text-blue-600 hover:underline">Ver cliente →</Link>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
