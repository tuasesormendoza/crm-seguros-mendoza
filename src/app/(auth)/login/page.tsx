'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Credenciales incorrectas')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ width: '45%', background: 'linear-gradient(145deg, #091e38 0%, #163352 55%, #0e7490 100%)' }}>
        <div style={{ position:'absolute', inset:0, opacity:.06, backgroundImage:'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize:'28px 28px', pointerEvents:'none' }} />

        <div className="relative flex items-center gap-3">
          <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <div style={{ color:'white', fontWeight:800, fontSize:'1.1rem', lineHeight:1 }}>CRM Seguros</div>
            <div style={{ color:'#7ab0cc', fontSize:'0.7rem', marginTop:3, letterSpacing:'0.05em' }}>AGENTES DE SALUD</div>
          </div>
        </div>

        <div className="relative">
          <h1 style={{ color:'white', fontSize:'2.4rem', fontWeight:800, lineHeight:1.15, marginBottom:'1rem' }}>
            Gestiona tu cartera<br />con inteligencia
          </h1>
          <p style={{ color:'#b8d4e8', lineHeight:1.7, fontSize:'0.95rem', maxWidth:340 }}>
            Tu plataforma centralizada para clientes, renovaciones, comisiones y seguimiento.
          </p>
          <div style={{ marginTop:'2.5rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            {['Seguimiento automático de renovaciones','Pipeline de prospectos integrado','Reportes de comisiones en tiempo real','Generador de tarjetas de plan con IA'].map(text => (
              <div key={text} style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <span style={{ width:22, height:22, borderRadius:'50%', background:'rgba(255,255,255,.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'#cffafe', fontSize:'0.7rem', fontWeight:700, flexShrink:0 }}>✓</span>
                <span style={{ color:'#b8d4e8', fontSize:'0.85rem' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color:'rgba(255,255,255,.25)', fontSize:'0.75rem' }}>© 2026 CRM Seguros · Todos los derechos reservados</div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem 1.5rem', background:'#f8fafc' }}>
        <div style={{ width:'100%', maxWidth:400 }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg, #2a6496, #0891b2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{ fontWeight:800, fontSize:'1.1rem', color:'#0f172a' }}>CRM Seguros</div>
          </div>

          <div style={{ marginBottom:'2rem' }}>
            <h2 style={{ fontSize:'1.6rem', fontWeight:800, color:'#0f172a', marginBottom:'0.4rem' }}>Iniciar sesión</h2>
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
                placeholder="tuasesormendoza@gmail.com"
                required
                autoComplete="email"
                style={{ width:'100%', padding:'0.75rem 1rem', borderRadius:12, fontSize:'0.875rem', background:'white', border:'1.5px solid #e2e8f0', color:'#0f172a', outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
                onFocus={e => { e.target.style.borderColor = '#4a90b8' }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
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
                  style={{ width:'100%', padding:'0.75rem 3rem 0.75rem 1rem', borderRadius:12, fontSize:'0.875rem', background:'white', border:'1.5px solid #e2e8f0', color:'#0f172a', outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
                  onFocus={e => { e.target.style.borderColor = '#4a90b8' }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
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

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.6rem 0.875rem', borderRadius:8, background:'#fee2e2', color:'#dc2626', fontSize:'0.8rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'0.8rem', borderRadius:12, border:'none', fontWeight:700, fontSize:'0.9rem', color:'white', cursor:'pointer', background: loading ? '#64748b' : 'linear-gradient(135deg, #2a6496, #0891b2)', boxShadow:'0 4px 14px rgba(42,100,150,.35)', transition:'opacity .15s', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Ingresando...' : 'Entrar al sistema →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
