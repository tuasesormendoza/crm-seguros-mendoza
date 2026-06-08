'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

// SVG Icons as components
const Icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  today: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  clients: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  pipeline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="12"/><rect x="17" y="3" width="5" height="8"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  commissions: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  report: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  card: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  referrals: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  docs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevronLeft: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  menu: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
}

const NAV = [
  { group: 'Principal', items: [
    { href: '/',             label: 'Dashboard',    icon: 'dashboard' },
    { href: '/today',        label: 'Hoy',          icon: 'today' },
    { href: '/clients',      label: 'Clientes',     icon: 'clients' },
    { href: '/pipeline',     label: 'Pipeline',     icon: 'pipeline' },
    { href: '/referidos',    label: 'Referidos',    icon: 'referrals' },
  ]},
  { group: 'Herramientas', items: [
    { href: '/calendar',     label: 'Calendario',   icon: 'calendar' },
    { href: '/commissions',  label: 'Comisiones',   icon: 'commissions' },
    { href: '/report',       label: 'Reporte',      icon: 'report' },
    { href: '/tarjeta',      label: 'Tarjeta Plan', icon: 'card' },
    { href: '/aptc',         label: 'Calc. APTC',   icon: 'commissions' },
    { href: '/documentos',   label: 'Documentos',   icon: 'docs' },
  ]},
]

// ── Digital Clock ─────────────────────────────────────────────────────────────

function DigitalClock() {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date()
      const h = now.getHours()
      const m = String(now.getMinutes()).padStart(2, '0')
      const s = String(now.getSeconds()).padStart(2, '0')
      const ampm = h >= 12 ? 'PM' : 'AM'
      const h12 = h % 12 || 12
      setTime(`${h12}:${m}:${s} ${ampm}`)
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="mx-3 mb-2 px-3 py-2.5 rounded-lg text-center shrink-0"
      style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
      <div className="font-mono font-bold tracking-widest"
        style={{ color: '#7ab0cc', fontSize: '1.15rem', letterSpacing: '0.1em' }}>
        {time}
      </div>
      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.3)' }}>{date}</div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [agentName, setAgentName] = useState('Omar Mendoza')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{id:string;fullName:string;insurer:string|null;status:string|null}[]>([])
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(d => {
      if (d.agentName) setAgentName(d.agentName)
      if (d.logoUrl && d.logoUrl !== 'undefined') setLogoUrl(d.logoUrl)
    }).catch(()=>{})
  }, [])

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); setShowSearch(false); return }
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(search)}`).then(r=>r.json()).then(d => {
        setSearchResults(d.slice(0,6))
        setShowSearch(true)
      })
    }, 280)
    return () => clearTimeout(t)
  }, [search])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  const initials = agentName.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: 'var(--surface-sidebar)' }}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        {!collapsed && (
          logoUrl ? (
            /* Custom logo */
            <div className="flex-1 min-w-0 flex items-center h-10 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain"
                style={{ filter: 'brightness(0) invert(1)', maxWidth: '160px' }} />
            </div>
          ) : (
            /* Default text logo */
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #4a90b8, #0891b2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              </div>
              <div className="min-w-0">
                <div className="text-white text-sm font-bold tracking-tight leading-none truncate">CRM Seguros</div>
                <div className="text-xs leading-none mt-0.5 truncate" style={{ color: '#7ab0cc' }}>Agentes de Salud</div>
              </div>
            </div>
          )
        )}
        {collapsed && (
          logoUrl ? (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto overflow-hidden"
              style={{ background: 'rgba(255,255,255,.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1"
                style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
              style={{ background: 'linear-gradient(135deg, #4a90b8, #0891b2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            </div>
          )
        )}
        <button onClick={() => setCollapsed(v=>!v)}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md transition-all hover:bg-white/10 text-white/40 hover:text-white/80 shrink-0"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}>
          {Icons.chevronLeft}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30">{Icons.search}</div>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg text-white placeholder-white/30 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)' }}
              onFocus={() => searchResults.length > 0 && setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl z-50 overflow-hidden animate-scale-in"
                style={{ background: 'var(--gray-800)', border: '1px solid rgba(255,255,255,.1)' }}>
                {searchResults.map(r => (
                  <button key={r.id} onMouseDown={() => { router.push(`/clients/${r.id}`); setSearch(''); setShowSearch(false) }}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-white/10">
                    <div className="text-xs font-medium text-white">{r.fullName}</div>
                    <div className="text-xs" style={{ color: 'var(--brand-300)' }}>{r.insurer} · {r.status}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV.map(group => (
          <div key={group.group}>
            {!collapsed && (
              <div className="px-2 mb-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.25)' }}>
                {group.group}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all group relative
                      ${active
                        ? 'text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                      }`}
                    style={active ? { background: 'rgba(255,255,255,.1)' } : {}}>
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" style={{ background: 'var(--brand-400)' }} />}
                    <span className={active ? 'text-white' : 'text-white/40 group-hover:text-white/60'}>
                      {Icons[item.icon as keyof typeof Icons]}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* New Client button */}
      {!collapsed && (
        <div className="px-3 pb-3 shrink-0">
          <Link href="/clients/new"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[.98]"
            style={{ background: 'linear-gradient(135deg, var(--brand-500), var(--teal-500))', color: 'white' }}>
            {Icons.plus}
            Nuevo Cliente
          </Link>
        </div>
      )}

      {/* Digital Clock */}
      {!collapsed && <DigitalClock />}

      {/* Bottom: Agent + Settings + Logout */}
      <div className="shrink-0 p-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <Link href="/settings"
          className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all text-white/50 hover:text-white/80 hover:bg-white/5">
          <span className="text-white/40">{Icons.settings}</span>
          {!collapsed && <span>Configuración</span>}
        </Link>
        <button onClick={logout}
          className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all text-white/50 hover:text-white/80 hover:bg-white/5 w-full">
          <span className="text-white/40">{Icons.logout}</span>
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg" style={{ background: 'rgba(255,255,255,.05)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--brand-400), var(--teal-500))', color: 'white' }}>
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{agentName}</div>
              <div className="text-xs truncate" style={{ color: 'var(--brand-300)' }}>Agente de Seguros</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col shrink-0 transition-all duration-200"
        style={{ width: collapsed ? '64px' : '220px', background: '#0f172a', minHeight: '100vh' }}>
        <SidebarContent />
      </aside>

      {/* Mobile hamburger */}
      <button className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-lg"
        style={{ background: 'var(--surface-sidebar)' }}
        onClick={() => setMobileOpen(v=>!v)}>
        {Icons.menu}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-56 animate-slide-in">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
