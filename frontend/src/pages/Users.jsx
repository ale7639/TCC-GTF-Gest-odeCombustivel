import { useEffect, useState } from 'react'
import api from '../api/client'
import { apiMessage, roleLabel } from '../utils/format'

export default function Users() {
  const [lista, setLista] = useState([])
  const [motoristas, setMotoristas] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  function carregar() {
    return Promise.all([
      api.get('/users').then(({ data }) => setLista(data)),
      api.get('/motoristas').then(({ data }) => setMotoristas(data)),
    ])
  }
  useEffect(() => { carregar().catch(() => setError('Falha ao carregar usuários.')) }, [])

  async function salvar(event) {
    event.preventDefault()
    setError('')
    try {
      await api.post('/users', form)
      setForm(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  async function papel(user, role) {
    await api.put(`/users/${user.id}`, { role })
    await carregar()
  }

  return (
    <div className="scroll stack">
      <div className="row space">
        <h1>Usuários</h1>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setForm({ name: '', email: '', password: '', role: 'motorista', motorista_id: '' })}>Novo</button>
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      {lista.map((u) => (
        <div key={u.id} className="card">
          <strong>{u.name}</strong>
          <p className="muted" style={{ margin: 0 }}>{u.email} · {roleLabel(u.role)}</p>
          <div className="filters" style={{ marginTop: 8 }}>
            {['administrador', 'supervisor', 'motorista'].map((r) => (
              <button key={r} className={`chip ${u.role === r ? 'on' : ''}`} onClick={() => papel(u, r)}>{roleLabel(r)}</button>
            ))}
          </div>
        </div>
      ))}
      {form && (
        <form className="card stack" onSubmit={salvar}>
          <h2>Novo usuário</h2>
          <div className="field"><label>Nome</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="field"><label>E-mail</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="field"><label>Senha</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="field">
            <label>Perfil</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="administrador">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="motorista">Motorista</option>
            </select>
          </div>
          {form.role === 'motorista' && (
            <div className="field">
              <label>Ficha de motorista</label>
              <select value={form.motorista_id} onChange={(e) => setForm({ ...form, motorista_id: e.target.value })}>
                <option value="">Sem vínculo</option>
                {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary">Criar</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
    </div>
  )
}
