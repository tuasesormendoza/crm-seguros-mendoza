// Estilos y helpers compartidos por las secciones de Configuración.

export const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#507b88] bg-white'
export const LABEL = 'block text-xs font-medium text-gray-600 mb-1'
export const SECTION = 'bg-white rounded-xl border border-gray-200 p-4 md:p-6'
export const TITLE = 'font-bold text-base mb-1'

export type Settings = Record<string, string>

export function SaveBtn({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="px-6 py-2 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-all"
      style={{ background: saved ? '#10b981' : '#10253f' }}
    >
      {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
    </button>
  )
}
