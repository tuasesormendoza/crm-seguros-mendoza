'use client'

// Piezas visuales básicas del perfil de cliente (InfoItem, CopyButton, Section).

import { useState } from 'react'

export function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide" style={{ color: '#507b88' }}>{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

export function CopyButton({ value }: { value?: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        } catch { /* clipboard unavailable — silently ignore */ }
      }}
      className="text-xs font-medium shrink-0 transition-colors"
      style={{ color: copied ? '#166534' : '#507b88' }}
      title="Copiar al portapapeles"
    >
      {copied ? '✓ Copiado' : '📋 Copiar'}
    </button>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold mb-4 text-base" style={{ color: '#10253f' }}>{title}</h2>
      {children}
    </div>
  )
}
