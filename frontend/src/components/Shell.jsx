import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  ),
  fleet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="13" height="9" rx="1.5" />
      <path d="M16 11h3l2 3v3h-5" />
      <circle cx="7.5" cy="18" r="1.5" /><circle cx="17.5" cy="18" r="1.5" />
    </svg>
  ),
  fuel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 21V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" />
      <path d="M7 21h10M15 10h2.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-2-2" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h16M7 16v-5M12 16V8M17 16v-8" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" />
    </svg>
  ),
}

export default function Shell() {
  const { canReport } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const hideNav = location.pathname.includes('/confirmacao')

  useEffect(() => {
    api.get('/alerts').then(({ data }) => setUnread(data.unread || 0)).catch(() => {})
  }, [location.pathname])

  return (
    <div className="app-screen">
      <Outlet context={{ unread, setUnread, goBack: () => navigate(-1) }} />
      {!hideNav && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          <NavLink to="/app" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {Icon.home} Dashboard
          </NavLink>
          <NavLink to="/app/frota" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {Icon.fleet} Frota
          </NavLink>
          <NavLink to="/app/abastecer" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {Icon.fuel} Abastecer
          </NavLink>
          {canReport ? (
            <NavLink to="/app/relatorios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {Icon.chart} Relatórios
            </NavLink>
          ) : (
            <span className="nav-item" aria-disabled="true" title="Acesso não autorizado para seu perfil">
              {Icon.chart} Relatórios
            </span>
          )}
          <NavLink to="/app/mais" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {Icon.more} Mais
          </NavLink>
        </nav>
      )}
    </div>
  )
}
