'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import ClientForm, { type FormData } from '@/components/ClientForm'
import Link from 'next/link'

interface Duplicate {
  id: string
  fullName: string
  reason: string
}

export default function NewClientPage() {
  const router = useRouter()
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const [checkKey, setCheckKey] = useState({ name: '', ssn: '' })

  const checkDuplicates = useCallback(async (name: string, ssn: string) => {
    if (!name && !ssn) { setDuplicates([]); return }
    const params = new URLSearchParams()
    if (ssn) params.set('ssn', ssn)
    if (name) params.set('name', name)
    const res = await fetch(`/api/clients/check-duplicate?${params}`)
    const data = await res.json()
    setDuplicates(data)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => checkDuplicates(checkKey.name, checkKey.ssn), 500)
    return () => clearTimeout(t)
  }, [checkKey, checkDuplicates])

  const handleSubmit = async (data: FormData) => {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const client = await res.json()
    router.push(`/clients/${client.id}`)
  }

  // We intercept form changes by wrapping onSubmit — but to detect field changes
  // we need the form to report back. We'll use a wrapper that also checks on submit.
  // For real-time detection we inject a hidden onChange observer via a wrapper component.
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
      <DuplicateAwareForm
        onSubmit={handleSubmit}
        onFieldChange={(name, ssn) => setCheckKey({ name, ssn })}
        duplicates={duplicates}
      />
    </div>
  )
}

function DuplicateAwareForm({
  onSubmit,
  onFieldChange,
  duplicates,
}: {
  onSubmit: (data: FormData) => Promise<void>
  onFieldChange: (name: string, ssn: string) => void
  duplicates: Duplicate[]
}) {
  const [lastName, setLastName] = useState('')
  const [lastSsn, setLastSsn] = useState('')

  const handleSubmit = async (data: FormData) => {
    // Check once more on submit
    if (data.fullName !== lastName || data.ssn !== lastSsn) {
      setLastName(data.fullName)
      setLastSsn(data.ssn)
      onFieldChange(data.fullName, data.ssn)
    }
    await onSubmit(data)
  }

  // We use a custom initialData-tracking approach via a thin wrapper
  return (
    <>
      <ClientFormWithTracking
        onSubmit={handleSubmit}
        submitLabel="Crear Cliente"
        onFieldChange={onFieldChange}
      />
      {duplicates.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-yellow-50 border-2 border-yellow-400 rounded-xl shadow-xl p-4">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-yellow-800 text-sm">Posible duplicado encontrado</p>
              <div className="mt-2 space-y-1">
                {duplicates.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-yellow-900">{d.fullName} <span className="text-yellow-600">({d.reason})</span></span>
                    <Link href={`/clients/${d.id}`} target="_blank" className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap">
                      Ver →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Thin wrapper that tracks fullName and ssn blur events
function ClientFormWithTracking({
  onSubmit,
  submitLabel,
  onFieldChange,
}: {
  onSubmit: (data: FormData) => Promise<void>
  submitLabel: string
  onFieldChange: (name: string, ssn: string) => void
}) {
  const [formSnapshot, setFormSnapshot] = useState({ name: '', ssn: '' })

  const handleSubmit = async (data: FormData) => {
    // Trigger check on submit as well
    if (data.fullName !== formSnapshot.name || data.ssn !== formSnapshot.ssn) {
      setFormSnapshot({ name: data.fullName, ssn: data.ssn })
      onFieldChange(data.fullName, data.ssn)
    }
    await onSubmit(data)
  }

  // We wrap the form in a div that intercepts blur events on name/ssn fields
  return (
    <div
      onBlur={(e) => {
        const input = e.target as HTMLInputElement
        // Detect blur on fullName or SSN via placeholder
        if (input.tagName === 'INPUT') {
          // We'll check all inputs and pass current values up
          const form = input.closest('form')
          if (!form) return
          const inputs = form.querySelectorAll('input')
          let name = formSnapshot.name
          let ssn = formSnapshot.ssn
          inputs.forEach(inp => {
            if (inp.placeholder === '000-00-0000') ssn = inp.value
          })
          // fullName is first input in form without placeholder usually — use aria or just scan
          const allInputs = Array.from(inputs)
          // First text input without placeholder is likely fullName
          const nameInput = allInputs.find(i => i.type === 'text' && !i.placeholder)
          if (nameInput) name = nameInput.value
          if (name !== formSnapshot.name || ssn !== formSnapshot.ssn) {
            setFormSnapshot({ name, ssn })
            onFieldChange(name, ssn)
          }
        }
      }}
    >
      <ClientForm
        onSubmit={handleSubmit}
        submitLabel={submitLabel}
      />
    </div>
  )
}
