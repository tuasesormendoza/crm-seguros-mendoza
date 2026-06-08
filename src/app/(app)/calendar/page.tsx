'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CalendarDay {
  appointments: { id: string; date: string; notes: string | null; status: string; client: { id: string; fullName: string } }[]
  renewals: { id: string; fullName: string; renewalDate: string; insurer: string | null }[]
  birthdays: { id: string; name: string; date: string; clientId?: string }[]
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState<Record<string, CalendarDay>>({})
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const m = `${year}-${String(month).padStart(2, '0')}`
    fetch(`/api/calendar?month=${m}`)
      .then(r => r.json())
      .then((res) => {
        const map: Record<string, CalendarDay> = {}
        for (const a of res.appointments || []) {
          const d = a.date.slice(0, 10)
          if (!map[d]) map[d] = { appointments: [], renewals: [], birthdays: [] }
          map[d].appointments.push(a)
        }
        for (const r of res.renewals || []) {
          const d = r.renewalDate.slice(0, 10)
          if (!map[d]) map[d] = { appointments: [], renewals: [], birthdays: [] }
          map[d].renewals.push(r)
        }
        for (const b of res.birthdays || []) {
          const d = b.date.slice(0, 10)
          if (!map[d]) map[d] = { appointments: [], renewals: [], birthdays: [] }
          map[d].birthdays.push(b)
        }
        setData(map)
      })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthName = new Date(year, month - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  const selectedDay = selected ? data[selected] : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold capitalize" style={{ color: '#10253f' }}>
          Calendario - {monthName}
        </h1>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: '#305a72' }}>← Anterior</button>
          <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg text-white text-sm" style={{ background: '#305a72' }}>Siguiente →</button>
        </div>
      </div>

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
          const isToday = dateStr === today.toISOString().slice(0, 10)
          const isSelected = selected === dateStr

          return (
            <div
              key={day}
              onClick={() => setSelected(isSelected ? null : dateStr)}
              className="h-24 rounded-lg p-1.5 cursor-pointer border transition-all"
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
        </div>
      )}

      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#305a72' }} /> Citas</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-yellow-400" /> Renovaciones</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block bg-pink-400" /> Cumpleaños</div>
      </div>
    </div>
  )
}
