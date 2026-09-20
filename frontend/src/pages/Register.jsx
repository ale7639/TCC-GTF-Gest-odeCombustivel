import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, fieldError } from '../utils/format'
import { passwordScore } from '../utils/password'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [error, setError] = useState('')
  const [field, setField] = useState({})
  const [loading, setLoading] = useState(false)
  const strength = useMemo(() => passwordScore(form.password), [form.password])

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setField({})
    if (form.password !== form.password_confirmation) {
      setField({ password: 'As senhas não coincidem.' })
      return
    }
    setLoading(true)
    try {
      await api.post('/register', form)
      navigate('/login', { state: { created: true } })
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível criar a conta.'))
      setField({
        email: fieldError(err, 'email'),
        password: fieldError(err, 'password'),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-screen">
      <div className="hero-auth">
        <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>Novo acesso</p>
        <h1>Criar conta</h1>
        <p>O administrador define o perfil operacional depois do cadastro.</p>
      </div>
      <div className="scroll auth-scroll">
        <form className="stack" onSubmit={submit}>
          {error && <div className="banner banner-danger">{error}</div>}
          <div className="field">
            <label>Nome completo</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className={`field ${field.email ? 'error' : ''}`}>
            <label>E-mail</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
            {field.email && <span className="error-text">{field.email}</span>}
          </div>
          <div className={`field ${field.password ? 'error' : ''}`}>
            <label>Senha</label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required />
            <div className="strength">
              <div className="strength-bar"><span style={{ width: strength.width, background: strength.color }} /></div>
              <span className="hint">{strength.label || 'Mínimo 8 caracteres, com maiúscula e número.'}</span>
            </div>
            {field.password && <span className="error-text">{field.password}</span>}
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <input type="password" value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} required />
          </div>
          {field.email && (
            <button type="button" className="btn btn-soft" onClick={() => { set('email', ''); setField({}); setError('') }}>
              Tentar outro e-mail
            </button>
          )}
          <button className="btn btn-primary" disabled={loading || !strength.valid}>{loading ? 'Criando...' : 'Criar conta'}</button>
          <Link className="link" to="/login">Já tenho conta · Entrar</Link>
        </form>
      </div>
    </div>
  )
}
