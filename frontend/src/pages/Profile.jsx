import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, km, roleLabel, statusBadge, statusLabel } from '../utils/format'

export default function Profile() {
  const { setUser } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [form, setForm] = useState({ name: '', telefone: '' })
  const [senha, setSenha] = useState({ senha_atual: '', password: '', password_confirmation: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/me')
      .then(({ data }) => {
        setPerfil(data)
        setForm({ name: data.name || '', telefone: data.telefone || data.telefone_exibicao || '' })
      })
      .catch(() => setError('Não foi possível carregar o perfil.'))
  }, [])

  async function salvarPerfil(event) {
    event.preventDefault()
    setError('')
    setOk('')
    setSaving(true)
    try {
      const { data } = await api.put('/me', form)
      setPerfil(data)
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        telefone: data.telefone,
        role: data.role,
        is_active: data.is_active,
        motorista_id: data.motorista_id,
      })
      setOk('Perfil atualizado.')
    } catch (err) {
      setError(apiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function salvarSenha(event) {
    event.preventDefault()
    setError('')
    setOk('')
    setSaving(true)
    try {
      await api.put('/me/senha', senha)
      setSenha({ senha_atual: '', password: '', password_confirmation: '' })
      setOk('Senha alterada.')
    } catch (err) {
      setError(apiMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!perfil && !error) return <div className="scroll"><p className="muted">Carregando…</p></div>

  return (
    <div className="scroll stack">
      <div>
        <p className="eyebrow">Conta</p>
        <h1>Meu perfil</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Dados da sessão e vínculo operacional.</p>
      </div>

      {error && <div className="banner banner-danger">{error}</div>}
      {ok && <div className="banner banner-ok">{ok}</div>}

      <div className="card stack">
        <div className="row" style={{ gap: 14 }}>
          <div className="profile-avatar">{(perfil?.name || '?').slice(0, 1).toUpperCase()}</div>
          <div className="grow">
            <strong style={{ fontSize: 18 }}>{perfil?.name}</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>{perfil?.email}</p>
            <span className="badge badge-ok" style={{ marginTop: 8 }}>{roleLabel(perfil?.role)}</span>
          </div>
        </div>
      </div>

      <form className="card stack" onSubmit={salvarPerfil}>
        <h2>Dados</h2>
        <div className="field">
          <label>Nome</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input value={perfil?.email || ''} disabled />
          <span className="hint">O e-mail de login não muda por aqui.</span>
        </div>
        <div className="field">
          <label>Telefone</label>
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="field">
          <label>Perfil</label>
          <input value={roleLabel(perfil?.role)} disabled />
        </div>
        <button className="btn btn-primary" disabled={saving}>Salvar perfil</button>
      </form>

      {(perfil?.motorista || perfil?.caminhao) && (
        <div className="card stack">
          <h2>Vínculo operacional</h2>
          {perfil.motorista && (
            <div className="mini">
              <div>
                <span>Motorista</span>
                <strong>{perfil.motorista.nome}</strong>
              </div>
              <div>
                <span>Telefone ficha</span>
                <strong>{perfil.motorista.telefone || '—'}</strong>
              </div>
              <div>
                <span>CNH</span>
                <strong>{perfil.motorista.cnh || '—'}</strong>
              </div>
              <div>
                <span>Validade CNH</span>
                <strong>{dateBr(perfil.motorista.cnh_validade)}</strong>
              </div>
            </div>
          )}
          {perfil.caminhao && (
            <Link className="list-item" to={`/app/frota/${perfil.caminhao.id}`} style={{ marginTop: 4 }}>
              <div className="truck-thumb">{perfil.caminhao.placa.slice(0, 3)}</div>
              <div className="grow">
                <div className="plate" style={{ fontSize: 20 }}>{perfil.caminhao.placa}</div>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {perfil.caminhao.modelo} · {km(perfil.caminhao.km_atual)}
                </p>
              </div>
              <span className={`badge ${statusBadge(perfil.caminhao.status)}`}>{statusLabel(perfil.caminhao.status)}</span>
            </Link>
          )}
        </div>
      )}

      <form className="card stack" onSubmit={salvarSenha}>
        <h2>Alterar senha</h2>
        <div className="field">
          <label>Senha atual</label>
          <input
            type="password"
            value={senha.senha_atual}
            onChange={(e) => setSenha({ ...senha, senha_atual: e.target.value })}
            required
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label>Nova senha</label>
          <input
            type="password"
            value={senha.password}
            onChange={(e) => setSenha({ ...senha, password: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="field">
          <label>Confirmar nova senha</label>
          <input
            type="password"
            value={senha.password_confirmation}
            onChange={(e) => setSenha({ ...senha, password_confirmation: e.target.value })}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <button className="btn btn-soft" disabled={saving}>Atualizar senha</button>
      </form>
    </div>
  )
}
