'use client'

// Subida del logo de la agencia (drag & drop o clic) — sección de Configuración.

import { useState, useRef } from 'react'

export default function LogoUploader({ currentUrl, onUploaded }: { currentUrl?: string; onUploaded: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayUrl = preview || (currentUrl && !currentUrl.startsWith('undefined') ? currentUrl : null)

  async function handleFile(file: File) {
    setError('')
    setUploading(true)
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.error || 'Error al subir')
      setPreview(null)
      return
    }
    onUploaded(data.logoUrl)
  }

  async function removeLogo() {
    if (!confirm('¿Eliminar el logo? Se mostrará el texto por defecto.')) return
    await fetch('/api/settings/logo', { method: 'DELETE' })
    setPreview(null)
    onUploaded(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h2 className="font-bold text-base mb-1" style={{ color: '#10253f' }}>🖼️ Logo de la Agencia</h2>
      <p className="text-xs text-gray-500 mb-4">
        Aparece en la barra lateral y en la pantalla de inicio de sesión.<br />
        <strong>Recomendado:</strong> PNG con fondo transparente, máximo 400×200 px, menos de 2 MB.
      </p>

      <div className="flex items-start gap-6 flex-wrap">
        {/* Preview */}
        <div className="flex-shrink-0">
          <div className="w-48 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden"
            style={{ background: '#f8fafc' }}>
            {displayUrl ? (
              <img src={displayUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
            ) : (
              <div className="text-center">
                <div className="text-2xl mb-1">🖼️</div>
                <p className="text-xs text-gray-400">Sin logo</p>
              </div>
            )}
          </div>
          {/* Dark bg preview */}
          {displayUrl && (
            <div className="w-48 h-12 rounded-xl mt-2 flex items-center justify-center overflow-hidden"
              style={{ background: '#0f172a' }}>
              <img src={displayUrl} alt="Logo oscuro" className="max-w-full max-h-full object-contain p-1.5"
                style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          )}
          {displayUrl && <p className="text-xs text-gray-400 mt-1 text-center">Vista en sidebar</p>}
        </div>

        {/* Upload controls */}
        <div className="flex-1 space-y-3">
          <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          <div
            className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-[#2a6496] hover:bg-blue-50"
            style={{ borderColor: '#e2e8f0' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2a6496' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0' }}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}>
            {uploading ? (
              <p className="text-sm text-gray-500">⏳ Subiendo logo...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Arrastra tu logo aquí o <span style={{ color: '#2a6496' }}>haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">PNG recomendado · máx. 2 MB</p>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600">⚠️ {error}</p>}

          {displayUrl && !uploading && (
            <button onClick={removeLogo} type="button"
              className="text-xs text-red-500 hover:text-red-700 underline">
              🗑️ Eliminar logo
            </button>
          )}

          <div className="text-xs text-gray-400 space-y-1">
            <p>✅ <strong>PNG con fondo transparente</strong> — se ve bien en fondo oscuro y claro</p>
            <p>✅ Tamaño ideal: 400×120 px o similar (proporción horizontal)</p>
            <p>✅ Si tu logo es oscuro, el sistema lo invierte automáticamente para el sidebar</p>
          </div>
        </div>
      </div>
    </div>
  )
}
