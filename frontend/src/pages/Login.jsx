import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiMessage } from '../utils/format'

/**
 * Login só com e-mail e senha — sem atalhos de contas de demonstração.
 */
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(apiMessage(err, 'E-mail ou senha inválidos.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-screen auth-screen">
      <div className="hero-auth">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div>
            <strong>GFC</strong>
            <small>Gestão de Combustível e Frota</small>
          </div>
        </div>
        <h1>Entre na sua conta</h1>
        <p>Use o e-mail e a senha fornecidos pela gestão da frota.</p>
      </div>
      <div className="scroll">
        <form className="stack auth-form" onSubmit={submit}>
          {error && <div className="banner banner-danger" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
