import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { firstName, roleLabel } from '../utils/format'
import { Icon, menuItems, quickItems } from '../navigation/navConfig'

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
      .catch(() => { /* silencioso: badge não bloqueia o app */ })
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

  const bellButton = (
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
  )

  const drawerLinks = (
    <>
      {drawer.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}>
          {item.label}
          {item.to === '/app/notificacoes' && naoLidas > 0 && (
            <span className="drawer-badge">{naoLidas > 9 ? '9+' : naoLidas}</span>
          )}
        </NavLink>
      ))}
      <button type="button" className="navlink out" onClick={sair}>Sair</button>
    </>
  )

  return (
    <div className={`app-screen${isAdmin ? ' app-screen-web' : ''}`}>
      {/* Barra lateral só no layout web do administrador (desktop). */}
      {isAdmin && (
        <aside className="side-nav" aria-label="Navegação principal">
          <div className="brand side-brand">
            <div className="brand-mark">G</div>
            <div>
              <strong>GFC</strong>
              <small>{firstName(user?.name)} · {roleLabel(user?.role)}</small>
            </div>
          </div>
          <nav className="side-nav-links">
            {drawer.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
                {item.to === '/app/notificacoes' && naoLidas > 0 && (
                  <span className="drawer-badge">{naoLidas > 9 ? '9+' : naoLidas}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="navlink out side-out" onClick={sair}>Sair</button>
        </aside>
      )}

      <div className="shell-main">
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
          {bellButton}
        </header>

        <Outlet />

        {/* Atalhos inferiores: papéis mobile; no admin só em telas estreitas. */}
        <nav className="bottom-nav" aria-label="Atalhos">
          {quick.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="bottom-nav-item">
              <span className="bottom-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {open && (
        <div className="overlay left" onClick={() => setOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <p className="eyebrow">Menu</p>
            <h2 style={{ marginBottom: 8 }}>{firstName(user?.name)}</h2>
            {drawerLinks}
          </nav>
        </div>
      )}
    </div>
  )
}
