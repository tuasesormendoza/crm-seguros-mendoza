'use client'

// ── Google Review Timeline ───────────────────────────────────────────────────

const REVIEW_STEPS = [
  {
    key: 'Pendiente por enviar',
    label: 'Pendiente\npor enviar',
    icon: '📋',
    desc: 'Aún no se ha solicitado la reseña al cliente.',
  },
  {
    key: 'Enviada',
    label: 'Enviada',
    icon: '📤',
    desc: 'Se envió el enlace de Google Review al cliente.',
  },
  {
    key: 'Esperando por el cliente',
    label: 'Esperando\nal cliente',
    icon: '⏳',
    desc: 'El cliente recibió el enlace y está pendiente de dejar la reseña.',
  },
  {
    key: 'Realizada',
    label: 'Realizada',
    icon: '⭐',
    desc: 'El cliente dejó su reseña en Google. ¡Gracias!',
  },
]

export default function GoogleReviewTimeline({ current }: { current?: string | null }) {
  const currentIdx = REVIEW_STEPS.findIndex(s => s.key === current)
  const activeIdx = currentIdx === -1 ? 0 : currentIdx

  return (
    <div>
      {/* Steps */}
      <div className="flex items-start gap-0">
        {REVIEW_STEPS.map((step, i) => {
          const isDone    = i < activeIdx
          const isActive  = i === activeIdx
          const isPending = i > activeIdx
          const isLast    = i === REVIEW_STEPS.length - 1

          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0">
              {/* Step + connector */}
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Circle + line row */}
                <div className="flex items-center w-full">
                  {/* Left connector */}
                  {i > 0 && (
                    <div className="flex-1 h-0.5 mt-0" style={{ background: isDone || isActive ? '#305a72' : '#e5e7eb' }} />
                  )}
                  {/* Circle */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 border-2 transition-all"
                    style={{
                      background: isDone ? '#305a72' : isActive ? '#10253f' : '#f9fafb',
                      borderColor: isDone || isActive ? '#10253f' : '#d1d5db',
                      color: isDone || isActive ? '#fff' : '#9ca3af',
                    }}
                  >
                    {isDone ? '✓' : step.icon}
                  </div>
                  {/* Right connector */}
                  {!isLast && (
                    <div className="flex-1 h-0.5" style={{ background: isDone ? '#305a72' : '#e5e7eb' }} />
                  )}
                </div>
                {/* Label */}
                <div className="mt-2 text-center px-1 w-full">
                  <p
                    className="text-xs font-semibold leading-tight whitespace-pre-line"
                    style={{ color: isActive ? '#10253f' : isDone ? '#305a72' : '#9ca3af' }}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Current step description */}
      {activeIdx >= 0 && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: '#f0f5f7', color: '#193c5c' }}>
          <span className="font-semibold">{REVIEW_STEPS[activeIdx].icon} {REVIEW_STEPS[activeIdx].key}:</span>{' '}
          {REVIEW_STEPS[activeIdx].desc}
        </div>
      )}
    </div>
  )
}
