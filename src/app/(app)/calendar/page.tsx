'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CalendarDay {
  appointments: { id: string; date: string; notes: string | null; status: string; client: { id: string; fullName: string } }[]
  renewals: { id: string; fullName: string; renewalDate: string; insurer: string | null }[]
  birthdays: { id: string; name: string; date: string; clientId?: string }[]
  events: { id: string; title: string; date: string; notes: string | null; client?: { id: string; fullName: string } | null }[]
}

interface ClientOption { id: string; fullName: string }

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState<Record<string, CalendarDay>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Selector de cliente (opcional) para vincular el evento a su perfil
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)

  function emptyDay(): CalendarDay {
    return { appointments: [], renewals: [], birthdays: [], events: [] }
  }

  function load() {
    const m = `${year}-${String(month).padStart(2, '0')}`
    fetch(`/api/calendar?month=${m}`)
      .then(r => r.json())
      .then((res) => {
        const map: Record<string, CalendarDay> = {}
        for (const a of res.appointments || []) {
          const d = a.date.slice(0, 10)
          if (!map[d]) map[d] = emptyDay()
          map[d].appointments.push(a)
        }
        for (const r of res.renewals || []) {
          const d = r.renewalDate.slice(0, 10)
          if (!map[d]) map[d] = emptyDay()
          map[d].renewals.push(r)
        }
        for (const b of res.birthdays || []) {
          const d = b.date.slice(0, 10)
          if (!map[d]) map[d] = emptyDay()
          map[d].birthdays.push(b)
        }
        for (const e of res.events || []) {
          const d = e.date.slice(0, 10)
          if (!map[d]) map[d] = emptyDay()
          map[d].events.push(e)
        }
        setData(map)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  // Lista de clientes para el selector (id + nombre), una sola vez
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then((res: ClientOption[]) => setClients(Array.isArray(res) ? res.map(c => ({ id: c.id, fullName: c.fullName })) : []))
      .catch(() => {}) // el selector es opcional: si falla, el evento se crea sin cliente
  }, [])

  const clientMatches = clientSearch.trim().length >= 2 && !selectedClient
    ? clients.filter(c => c.fullName.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8)
    : []

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.date) return
    setSaving(true)
    try {
      const dateTime = form.time ? `${form.date}T${form.time}:00` : `${form.date}T12:00:00`
      await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, date: dateTime, notes: form.notes || null, clientId: selectedClient?.id || null }),
      })
      setForm({ title: '', date: '', time: '', notes: '' })
      setSelectedClient(null)
      setClientSearch('')
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('¿Eliminar este evento?')) return
    await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' })
    load()
  }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthName = new Date(year, month - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  const selectedDay = selected ? data[selected] : null
  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold capitalize" style={{ color: '#10253f' }}>
          Calendario - {monthName}
        </h1>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: '#305a72' }}>← Anterior</button>
          <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: '#305a72' }}>Siguiente →</button>
          <button
            onClick={() => {
              setForm(f => ({ ...f, date: selected || todayStr }))
              setShowForm(true)
            }}
            className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold"
            style={{ background: '#10253f' }}
          >
            + Nuevo evento
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 bg-white rounded-xl shadow-md p-5 border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg" style={{ color: '#10253f' }}>Nuevo evento</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <form onSubmit={handleCreateEvent} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#507b88' }}>Título</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                className="w-full px-3 py-2 rounded-lg border text-sm"
                placeholder="Ej. Llamar al cliente, Reunión de equipo..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#507b88' }}>Fecha</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#507b88' }}>Hora (opcional)</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#507b88' }}>Notas (opcional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#507b88' }}>
                Cliente relacionado (opcional)
                <span className="ml-2 font-normal text-gray-400">Se registrará una nota en su perfil</span>
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border" style={{ background: '#f0f7fb', borderColor: '#b8d4e8' }}>
                  <span className="text-sm font-semibold" style={{ color: '#0369a1' }}>👤 {selectedClient.fullName}</span>
                  <button type="button" onClick={() => { setSelectedClient(null); setClientSearch('') }}
                    className="text-xs text-gray-500 hover:text-red-600">Quitar ✕</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    placeholder="Escribe el nombre del cliente para buscar..."
                  />
                  {clientMatches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {clientMatches.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setSelectedClient(c); setClientSearch('') }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0">
                          {c.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !form.title || !form.date}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: '#10253f' }}
              >
                {saving ? 'Guardando...' : 'Guardar evento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
          <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: '#507b88' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="h-24 rounded-lg bg-gray-50" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayData = data[dateStr]
          const isToday = dateStr === todayStr
          const isSelected = selected === dateStr

          return (
            <div
              key={day}
              onClick={() => setSelected(isSelected ? null : dateStr)}
              className="h-24 rounded-lg p-1.5 cursor-pointer border transition-all overflow-hidden"
              style={{
                background: isSelected ? '#e8f0f4' : isToday ? '#f0f7ff' : 'white',
                borderColor: isSelected ? '#305a72' : isToday ? '#7fa4a4' : '#e5e7eb',
              }}
            >
              <div className="text-sm font-medium mb-1" style={{ color: isToday ? '#305a72' : '#10253f' }}>{day}</div>
              {dayData && (
                <div className="space-y-0.5">
                  {dayData.appointments.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#305a72' }} />
                      <span className="text-xs" style={{ color: '#305a72' }}>{dayData.appointments.length} cita{dayData.appointments.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {dayData.renewals.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block bg-yellow-400" />
                      <span className="text-xs text-yellow-700">{dayData.renewals.length} renov.</span>
                    </div>
                  )}
                  {dayData.events.map(e => (
                    <div key={e.id} className="flex items-center gap-1 min-w-0">
                      <span className="w-2 h-2 rounded-full inline-block bg-purple-500 shrink-0" />
                      <span className="text-xs text-purple-700 truncate font-medium leading-tight">{e.title}</span>
                    </div>
                  ))}
                  {dayData.birthdays.map(b => (
                    <div key={b.id} className="flex items-center gap-1 min-w-0">
                      <span className="text-xs shrink-0">🎂</span>
                      <span className="text-xs text-pink-700 truncate font-medium leading-tight">
                        {b.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selected && selectedDay && (
        <div className="mt-6 bg-white rounded-xl shadow-md p-5 border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg" style={{ color: '#10253f' }}>
              {new Date(selected + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {selectedDay.events.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-2 text-purple-700">Eventos</h3>
              {selectedDay.events.map(e => (
                <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm" style={{ color: '#10253f' }}>{e.title}</p>
                    {e.notes && <p className="text-xs text-gray-500">{e.notes}</p>}
                    {e.client && (
                      <Link href={`/clients/${e.client.id}`} className="text-xs font-medium hover:underline" style={{ color: '#0369a1' }}>
                        👤 {e.client.fullName}
                      </Link>
                    )}
                    <p className="text-xs text-gray-400">{new Date(e.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={() => handleDeleteEvent(e.id)} className="text-gray-400 hover:text-red-600 text-sm px-2">🗑</button>
                </div>
              ))}
            </div>
          )}

          {selectedDay.appointments.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-2" style={{ color: '#305a72' }}>Citas</h3>
              {selectedDay.appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <Link href={`/clients/${a.client.id}`} className="font-medium text-sm hover:underline" style={{ color: '#10253f' }}>{a.client.fullName}</Link>
                    {a.notes && <p className="text-xs text-gray-500">{a.notes}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{a.status}</span>
                </div>
              ))}
            </div>
          )}

          {selectedDay.renewals.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-2 text-yellow-700">Renovaciones</h3>
              {selectedDay.renewals.map(r => (
                <div key={r.id} className="py-1.5 border-b last:border-0">
                  <Link href={`/clients/${r.id}`} className="font-medium text-sm hover:underline" style={{ color: '#10253f' }}>{r.fullName}</Link>
                  {r.insurer && <span className="text-xs text-gray-500 ml-2">— {r.insurer}</span>}
                </div>
              ))}
            </div>
          )}

          {selectedDay.birthdays.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2 text-pink-700">Cumpleaños</h3>
              {selectedDay.birthdays.map(b => (
                <div key={b.id} className="py-1.5 border-b last:border-0">
                  {b.clientId
                    ? <Link href={`/clients/${b.clientId}`} className="font-medium text-sm hover:underline" style={{ color: '#10253f' }}>{b.name}</Link>
                    : <span className="font-medium text-sm" style={{ color: '#10253f' }}>{b.name}</span>
                  }
                </div>
              ))}
            </div>
          )}

          {selectedDay.events.length === 0 && selectedDay.appointments.length === 0 && selectedDay.renewals.length === 0 && selectedDay.birthdays.length === 0 && (
            <p className="text-sm text-gray-400">No hay nada programado para este día.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-4 text-xs text-gray-500 flex-wrap">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#305a72' }} /> Citas</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-yellow-400" /> Renovaciones</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-pink-400" /> Cumpleaños</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-purple-500" /> Eventos</div>
      </div>
    </div>
  )
}
