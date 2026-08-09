'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TwoFactorStep from '@/components/auth/TwoFactorStep'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // El proxy añade ?expirada=1 cuando echa a alguien que estaba dentro.
  // Sin este aviso, la pantalla de login aparece de la nada y parece que
  // la aplicación se hubiera cerrado sola.
  const [expirada, setExpirada] = useState(false)
  // Paso del inicio de sesión: contraseña → segundo factor (verificar o registrar).
  const [step, setStep] = useState<'password' | 'verify' | 'enroll'>('password')
  const router = useRouter()

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('expirada') === '1') {
      setExpirada(true)
    }
  }, [])

  function enter() {
    router.push('/')
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      // La contraseña es correcta, pero el 2FA es obligatorio: se pasa al
      // segundo paso (verificar el código o registrar el autenticador).
      if (data.requires2fa) { setStep('verify'); setPassword(''); return }
      if (data.requiresEnroll) { setStep('enroll'); setPassword(''); return }
      enter()
    } else {
      setError(data.error || 'Credenciales incorrectas')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ width: '45%', background: 'linear-gradient(145deg, #032b40 0%, var(--brand-800) 55%, #0a7a9e 100%)' }}>

        {/* Dot grid */}
        <div style={{ position:'absolute', inset:0, opacity:.05, backgroundImage:'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize:'28px 28px', pointerEvents:'none' }} />
        {/* Amber glow */}
        <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:340, height:340, borderRadius:'50%', background:'radial-gradient(circle, rgba(var(--accent-rgb), .22) 0%, transparent 70%)', pointerEvents:'none' }} />
        {/* Cyan glow */}
        <div style={{ position:'absolute', top:'15%', right:'10%', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(var(--brand-300-rgb), .15) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div className="relative flex items-center gap-3">
          <div style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg, var(--brand-500), var(--brand-300))', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-800)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:'1.1rem', lineHeight:1 }}>CRM Seguros</div>
            <div style={{ color:'var(--brand-300)', fontSize:'0.7rem', marginTop:3, letterSpacing:'0.08em' }}>AGENTES DE SALUD</div>
          </div>
        </div>

        <div className="relative">
          <h1 style={{ color:'white', fontSize:'2.4rem', fontWeight:800, lineHeight:1.15, marginBottom:'1rem' }}>
            Gestiona tu cartera<br />con inteligencia
          </h1>
          <p style={{ color:'rgba(var(--brand-300-rgb), .80)', lineHeight:1.7, fontSize:'0.95rem', maxWidth:340 }}>
            Tu plataforma centralizada para clientes, renovaciones, comisiones y seguimiento.
          </p>
          <div style={{ marginTop:'2.5rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            {['Seguimiento automático de renovaciones','Pipeline de prospectos integrado','Reportes de comisiones en tiempo real','Generador de tarjetas de plan con IA'].map(text => (
              <div key={text} style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <span style={{ width:22, height:22, borderRadius:'50%', background:'rgba(var(--accent-rgb), .25)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', fontSize:'0.7rem', fontWeight:700, flexShrink:0, border:'1px solid rgba(var(--accent-rgb), .35)' }}>✓</span>
                <span style={{ color:'rgba(var(--brand-300-rgb), .80)', fontSize:'0.85rem' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color:'rgba(255,255,255,.25)', fontSize:'0.75rem' }}>© 2026 CRM Seguros · Todos los derechos reservados</div>
      </div>

      {/* ── Right form panel — Liquid Glass ── */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem 1.5rem',
        background:'radial-gradient(ellipse at 20% 30%, rgba(var(--brand-300-rgb), .30) 0%, transparent 55%), radial-gradient(ellipse at 80% 75%, rgba(var(--accent-rgb), .18) 0%, transparent 50%), #f0f9fd',
      }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg, var(--brand-500), var(--brand-300))', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-800)" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{ fontWeight:800, fontSize:'1.1rem', color:'var(--brand-800)' }}>CRM Seguros</div>
          </div>

          {/* Glass card */}
          <div style={{
            background:'rgba(255,255,255,0.70)',
            backdropFilter:'blur(24px) saturate(1.8)',
            WebkitBackdropFilter:'blur(24px) saturate(1.8)',
            borderRadius:24,
            border:'1px solid rgba(255,255,255,0.65)',
            boxShadow:'0 16px 48px rgba(var(--brand-800-rgb), 0.14), 0 1px 0 rgba(255,255,255,0.85) inset',
            padding:'2.25rem 2rem',
          }}>
            {step !== 'password' ? (
              <TwoFactorStep mode={step} onDone={enter} />
            ) : (
            <>
            <div style={{ marginBottom:'1.75rem' }}>
              <h2 style={{ fontSize:'1.6rem', fontWeight:800, color:'var(--brand-800)', marginBottom:'0.4rem' }}>Iniciar sesión</h2>
              <p style={{ color:'#64748b', fontSize:'0.875rem' }}>Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {/* Email */}
              <div>
                <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#334155', marginBottom:'0.4rem' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  autoComplete="email"
                  style={{ width:'100%', padding:'0.75rem 1rem', borderRadius:12, fontSize:'0.875rem', background:'rgba(255,255,255,0.85)', border:'1.5px solid rgba(var(--brand-500-rgb), 0.25)', color:'#0f172a', outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--brand-500)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(var(--brand-500-rgb), 0.25)' }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#334155', marginBottom:'0.4rem' }}>
                  Contraseña
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    required
                    autoComplete="current-password"
                    style={{ width:'100%', padding:'0.75rem 3rem 0.75rem 1rem', borderRadius:12, fontSize:'0.875rem', background:'rgba(255,255,255,0.85)', border:'1.5px solid rgba(var(--brand-500-rgb), 0.25)', color:'#0f172a', outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--brand-500)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(var(--brand-500-rgb), 0.25)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:0 }}>
                    {showPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {expirada && !error && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.6rem 0.875rem', borderRadius:10, background:'rgba(37,99,235,0.08)', color:'#1d4ed8', fontSize:'0.8rem', border:'1px solid rgba(37,99,235,0.20)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Tu sesión caducó por inactividad. Vuelve a entrar y sigues donde estabas.
                </div>
              )}

              {error && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.6rem 0.875rem', borderRadius:10, background:'rgba(220,38,38,0.08)', color:'#dc2626', fontSize:'0.8rem', border:'1px solid rgba(220,38,38,0.20)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'0.85rem', borderRadius:12, border:'none', fontWeight:700, fontSize:'0.9rem', color:'white', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#64748b' : 'linear-gradient(135deg, var(--brand-800), var(--brand-500))', boxShadow: loading ? 'none' : '0 4px 20px rgba(var(--brand-800-rgb), .35)', transition:'all .15s', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Ingresando...' : 'Entrar al sistema →'}
              </button>
            </form>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
