import { Link, useNavigate } from 'react-router-dom'
import { roleLabel } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function More() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  async function leave() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="scroll">
      <p className="eyebrow">Conta</p>
      <h1>{user?.name}</h1>
      <p className="muted">{user?.email} · {roleLabel(user?.role)}</p>
      <div className="list" style={{ marginTop: 18 }}>
        <Link className="list-item" to="/app/alertas">Central de alertas</Link>
        <Link className="list-item" to="/app/senha">Trocar senha</Link>
        {isAdmin && <Link className="list-item" to="/app/usuarios">Usuários e perfis</Link>}
        {isAdmin && <Link className="list-item" to="/app/auditoria">Auditoria</Link>}
        {isAdmin && <a className="list-item" href="http://localhost:8081" target="_blank" rel="noreferrer">Administrar banco (phpMyAdmin)</a>}
      </div>
      <button className="btn btn-soft" style={{ marginTop: 18 }} onClick={leave}>Sair</button>
    </div>
  )
}
