import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiMessage } from '../utils/format'

const demos = [
  { label: 'Admin', email: 'diego@gfc.com.br' },
  { label: 'Supervisor', email: 'ana@gfc.com.br' },
  { label: 'Motorista', email: 'joao@gfc.com.br' },
]

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
    <div className="app-screen">
      <div className="hero-auth">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div>
            <strong>GFC</strong>
            <small>Gestão de Combustível e Frota</small>
          </div>
        </div>
        <h1>O pátio e a estrada no mesmo celular.</h1>
        <p>Tanques da base, frota, posto fora da empresa e o histórico para a gestão.</p>
        <div className="row" style={{ marginTop: 18, flexWrap: 'wrap' }}>
          {demos.map((item) => (
            <button
              key={item.email}
              type="button"
              className="demo-chip"
              onClick={() => { setEmail(item.email); setPassword('Senha123') }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="scroll">
        <form className="stack" onSubmit={submit}>
          {error && <div className="banner banner-danger" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
