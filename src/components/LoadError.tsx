'use client'

// Estado de error para cargas de datos fallidas: mensaje claro + reintentar.
// Reemplaza el anti-patrón de dejar la pantalla en "Cargando..." para siempre
// cuando la petición inicial falla (red caída, sesión expirada, error 500).

export default function LoadError({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-4xl mb-3">📡</div>
        <p className="text-sm font-semibold text-gray-700 mb-1">
          {message || 'No se pudo cargar la información'}
        </p>
        <p className="text-xs text-gray-400 mb-4">Revisa tu conexión a internet e intenta de nuevo.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#10253f' }}
        >
          ↻ Reintentar
        </button>
      </div>
    </div>
  )
}
