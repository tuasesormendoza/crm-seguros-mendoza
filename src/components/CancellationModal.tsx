'use client'

import { useState } from 'react'

interface Props {
  clientId: string
  clientName: string
  wnHasPolicy: boolean
  wnSecondPaymentReceived: boolean
  onConfirm: (data: { cancellationDate: string; addToProspects: boolean }) => Promise<void>
  onSkip: (data: { cancellationDate: string }) => void  // actualiza el cliente sin agregar a prospectos
  onClose: () => void  // cancela completamente (no se registra nada)
}

export default function CancellationModal({
  clientName,
  wnHasPolicy,
  wnSecondPaymentReceived,
  onConfirm,
  onSkip,
  onClose,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [cancellationDate, setCancellationDate] = useState(today)
  const [addToProspects, setAddToProspects] = useState(true)
  const [saving, setSaving] = useState(false)

  const showWnWarning = wnHasPolicy && !wnSecondPaymentReceived

  async function handleConfirm() {
    if (!cancellationDate) return
    setSaving(true)
    await onConfirm({ cancellationDate, addToProspects })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#10253f' }}>
            Marcar como cancelado
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            <strong>{clientName}</strong> se fue con otro agente.
            ¿Quieres actualizar su perfil y registrar la fecha?
          </p>
        </div>

        {showWnWarning && (
          <div className="p-3 rounded-lg text-sm" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            <strong>⚠️ Riesgo de clawback WN</strong><br />
            Este cliente tiene una póliza Washington National y aún no se ha
            confirmado el segundo pago. Si canceló antes del mes 8, podrías
            tener que devolver la comisión — revisa el panel WN en su perfil.
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Fecha en que canceló
          </label>
          <input
            type="date"
            value={cancellationDate}
            onChange={e => setCancellationDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] w-full"
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={addToProspects}
            onChange={e => setAddToProspects(e.target.checked)}
            className="mt-0.5 accent-[#305a72]"
          />
          <span className="text-sm text-gray-700">
            Agregar al pipeline de prospectos como <em>Cerrado – Perdido</em> para
            intentar recuperarlo en el futuro
          </span>
        </label>

        <div className="flex gap-2 pt-1 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSkip({ cancellationDate })}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            Solo registrar motivo
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !cancellationDate}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 min-w-[120px]"
            style={{ background: '#991b1b' }}
          >
            {saving ? 'Guardando…' : 'Confirmar y actualizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
