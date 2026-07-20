'use client'

import { useState } from 'react'

// ── Appointment Modal ────────────────────────────────────────────────────────

export default function AppointmentModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (data: { date: string; doctorName: string; location: string; notes: string; status: string }) => Promise<void>
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [doctorName, setDoctorName] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Programada')
  const [saving, setSaving] = useState(false)

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return
    setSaving(true)
    try { await onSave({ date: `${date}T${time}:00`, doctorName, location, notes, status }) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4" style={{ color: '#10253f' }}>🩺 Cita Médica</h3>
        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del médico</label>
            <input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)}
              placeholder="Dr. Juan Pérez — Médico Primario / Especialista"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dirección del consultorio</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)}
              placeholder="123 Main St, Suite 100, Orlando, FL"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo / Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Chequeo anual, seguimiento, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estatus</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88]">
              {['Programada', 'Completada', 'Cancelada', 'Reagendada'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !date}
              className="flex-1 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: '#10253f' }}>
              {saving ? 'Guardando...' : 'Guardar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
