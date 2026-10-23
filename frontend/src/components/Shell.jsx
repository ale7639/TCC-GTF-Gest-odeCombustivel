import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { firstName, roleLabel } from '../utils/format'

export default function Shell() {
  const { user, isAdmin, isGestao, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="app-screen">
      <header className="topbar">
        <button className="hamburger" aria-label="Abrir menu" onClick={() => setOpen(true)}>
          <span /><span /><span />
        </button>
        <div className="brand grow">
          <div className="brand-mark">G</div>
          <div>
            <strong>GFC</strong>
            <small>{firstName(user?.name)} · {roleLabel(user?.role)}</small>
          </div>
        </div>
      </header>
      <Outlet />
      {open && (
        <div className="overlay left" onClick={() => setOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <p className="eyebrow">Menu</p>
            <h2 style={{ marginBottom: 8 }}>{firstName(user?.name)}</h2>
            <NavLink to="/app" end onClick={() => setOpen(false)}>Painel</NavLink>
            <NavLink to="/app/frota" onClick={() => setOpen(false)}>Frota</NavLink>
            <NavLink to="/app/abastecer" onClick={() => setOpen(false)}>Abastecer</NavLink>
            <NavLink to="/app/tanques" onClick={() => setOpen(false)}>Tanques</NavLink>
            {isGestao && <NavLink to="/app/motoristas" onClick={() => setOpen(false)}>Motoristas</NavLink>}
            {isGestao && <NavLink to="/app/relatorios" onClick={() => setOpen(false)}>Relatórios</NavLink>}
            {isAdmin && <NavLink to="/app/usuarios" onClick={() => setOpen(false)}>Usuários</NavLink>}
            <button
              className="navlink out"
              onClick={async () => {
                await logout()
                go('/login')
              }}
            >
              Sair
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
