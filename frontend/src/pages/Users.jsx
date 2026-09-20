import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../api/client'
import { apiMessage } from '../utils/format'
import { useAuth } from '../context/AuthContext'

const emptyUser = {
  name: '',
  email: '',
  password: 'Senha123',
  role: 'motorista',
}

export default function Users() {
  const { isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyUser)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    api.get('/users').then(({ data }) => setUsers(data.data)).catch(() => {})
  }, [isAdmin])

  async function changeRole(id, role) {
    const { data } = await api.put(`/users/${id}`, { role })
    setUsers((current) => current.map((item) => item.id === id ? data.data : item))
  }

  async function createUser(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { data } = await api.post('/users', form)
      setUsers((current) => [...current, data.data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(emptyUser)
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível criar o usuário.'))
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return <Navigate to="/app/mais" replace />

  return (
    <div className="scroll">
      <h1>Usuários</h1>
      <p className="muted">Crie o motorista aqui e depois vincule no cadastro do caminhão.</p>

      <form className="card stack" style={{ marginTop: 16 }} onSubmit={createUser}>
        <strong>Novo usuário</strong>
        {error && <div className="banner banner-danger">{error}</div>}
        <div className="field">
          <label>Nome</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="field">
          <label>Senha</label>
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <span className="hint">Mínimo 8 caracteres, com maiúscula e número.</span>
        </div>
        <div className="field">
          <label>Perfil</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="motorista">Motorista</option>
            <option value="supervisor">Supervisor</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar usuário'}</button>
      </form>

      <div className="list" style={{ marginTop: 16 }}>
        {users.map((item) => (
          <div className="list-item" key={item.id}>
            <div className="grow">
              <strong>{item.name}</strong>
              <div className="muted">{item.email}</div>
            </div>
            <select value={item.role} onChange={(e) => changeRole(item.id, e.target.value)}>
              <option value="administrador">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="motorista">Motorista</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
