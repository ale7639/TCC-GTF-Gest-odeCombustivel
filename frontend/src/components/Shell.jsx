import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { firstName, roleLabel } from '../utils/format'

const Icon = {
  home: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill="currentColor" /></svg>
  ),
  fleet: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h9A1.5 1.5 0 0 1 15 7.5V9h2.2c.5 0 .96.24 1.25.64l2.1 2.9c.2.28.3.61.3.96V17a1 1 0 0 1-1 1h-1.1a2.5 2.5 0 0 1-4.8 0H9.05a2.5 2.5 0 0 1-4.8 0H3a1 1 0 0 1-1-1V7.5ZM6.5 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM15 11v2.5h4.3l-1.5-2.1A.5.5 0 0 0 17.4 11H15Z" fill="currentColor" /></svg>
  ),
  fuel: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7a2 2 0 0 1 2 2v12.5a1.5 1.5 0 1 1-3 0V16H8v1.5a1.5 1.5 0 1 1-3 0V5a2 2 0 0 1 2-2Zm1 4h5v5H8V7Zm10.2 1.2 1.3 1.3A3 3 0 0 1 20.5 12v5.5a1.5 1.5 0 1 1-3 0V12a.5.5 0 0 0-.15-.35l-1.2-1.2.85-.85a1 1 0 0 1 1.4 0Z" fill="currentColor" /></svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.5 5.5l-5.1 5.1a1.5 1.5 0 0 0 2.1 2.1l5.1-5.1a4 4 0 0 0 5.5-5.5l-2.2 2.2-2.1-.3-.3-2.1 2.5-2Z" fill="currentColor" /></svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14v2H5v-2Zm1-2V9h2v8H6Zm5 0V5h2v12h-2Zm5 0v-5h2v5h-2Z" fill="currentColor" /></svg>
  ),
  tank: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v2H7V4Zm-1 3h12a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2Zm2 3v8h8v-2.5c-1.2 0-2-.8-2-2s.8-2 2-2V10H8Z" fill="currentColor" /></svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v2.2c0 .7-.2 1.3-.6 1.9L4.2 15.4A1 1 0 0 0 5 17h14a1 1 0 0 0 .8-1.6l-1.2-2.3c-.4-.6-.6-1.2-.6-1.9V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z" fill="currentColor" /></svg>
  ),
}

function menuItems({ isGestao, isAdmin }) {
  const base = [
    { to: '/app', label: 'Início', end: true },
    { to: '/app/perfil', label: 'Meu perfil' },
    { to: '/app/notificacoes', label: 'Notificações' },
    { to: '/app/frota', label: 'Frota' },
    { to: '/app/abastecer', label: 'Abastecer' },
    { to: '/app/manutencao', label: 'Manutenção' },
    { to: '/app/tanques', label: 'Tanques' },
  ]
  base.push({ to: '/app/saida', label: 'Checklist saída' })
  if (isGestao) {
    base.push({ to: '/app/motoristas', label: 'Motoristas' })
    base.push({ to: '/app/multas', label: 'Multas' })
    base.push({ to: '/app/relatorios', label: 'Relatórios' })
  }
  if (isAdmin) base.push({ to: '/app/usuarios', label: 'Usuários' })
  return base
}

function quickItems({ isGestao }) {
  if (isGestao) {
    return [
      { to: '/app', label: 'Início', icon: Icon.home, end: true },
      { to: '/app/frota', label: 'Frota', icon: Icon.fleet },
      { to: '/app/abastecer', label: 'Abastecer', icon: Icon.fuel },
      { to: '/app/manutencao', label: 'Manutenção', icon: Icon.wrench },
      { to: '/app/relatorios', label: 'Relatórios', icon: Icon.chart },
    ]
  }
  return [
    { to: '/app', label: 'Início', icon: Icon.home, end: true },
    { to: '/app/frota', label: 'Frota', icon: Icon.fleet },
    { to: '/app/abastecer', label: 'Abastecer', icon: Icon.fuel },
    { to: '/app/manutencao', label: 'Manutenção', icon: Icon.wrench },
    { to: '/app/tanques', label: 'Tanques', icon: Icon.tank },
  ]
}

export default function Shell() {
  const { user, isAdmin, isGestao, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [naoLidas, setNaoLidas] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const drawer = menuItems({ isGestao, isAdmin })
  const quick = quickItems({ isGestao })

  const atualizarBadge = useCallback(() => {
    api.get('/notificacoes/resumo')
      .then(({ data }) => setNaoLidas(data.nao_lidas || 0))
      .catch(() => { /* silencioso */ })
  }, [])

  useEffect(() => {
    atualizarBadge()
    const onFocus = () => atualizarBadge()
    const onCustom = () => atualizarBadge()
    window.addEventListener('focus', onFocus)
    window.addEventListener('gfc:notificacoes', onCustom)
    const timer = setInterval(atualizarBadge, 60000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('gfc:notificacoes', onCustom)
      clearInterval(timer)
    }
  }, [atualizarBadge, location.pathname])

  async function sair() {
    setOpen(false)
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-screen">
      <header className="topbar">
        <button type="button" className="hamburger" aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <span /><span /><span />
        </button>
        <div className="brand grow">
          <div className="brand-mark">G</div>
          <div>
            <strong>GFC</strong>
            <small>{firstName(user?.name)} · {roleLabel(user?.role)}</small>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'}
          onClick={() => navigate('/app/notificacoes')}
        >
          {Icon.bell}
          {naoLidas > 0 && (
            <span className="notif-badge">{naoLidas > 9 ? '9+' : naoLidas}</span>
          )}
        </button>
      </header>

      <Outlet />

      <nav className="bottom-nav" aria-label="Atalhos">
        {quick.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="bottom-nav-item">
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {open && (
        <div className="overlay left" onClick={() => setOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <p className="eyebrow">Menu</p>
            <h2 style={{ marginBottom: 8 }}>{firstName(user?.name)}</h2>
            {drawer.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}>
                {item.label}
                {item.to === '/app/notificacoes' && naoLidas > 0 && (
                  <span className="drawer-badge">{naoLidas > 9 ? '9+' : naoLidas}</span>
                )}
              </NavLink>
            ))}
            <button type="button" className="navlink out" onClick={sair}>Sair</button>
          </nav>
        </div>
      )}
    </div>
  )
}
