import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(apiMessage(err, 'E-mail ou senha inválidos. Verifique seus dados e tente novamente.'))
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
        <h1>Controle a operação no pátio e na estrada.</h1>
        <p>Entre com seu perfil para ver o tanque, a frota e as pendências do dia.</p>
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
      <div className="scroll auth-scroll">
        <form className="stack" onSubmit={submit}>
          {location.state?.created && !error && (
            <div className="banner banner-ok">Conta criada com sucesso. Faça login para continuar.</div>
          )}
          {error && <div className="banner banner-danger" role="alert">{error}</div>}
          <div className={`field ${error ? 'error' : ''}`}>
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className={`field ${error ? 'error' : ''}`}>
            <label htmlFor="password">Senha</label>
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="btn btn-ghost" onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            </button>
          </div>
          <button className="btn btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
          <Link className="link" to="/recuperar-senha">Esqueci minha senha</Link>
          <p className="muted">Ainda não tem acesso? <Link className="link" to="/criar-conta">Criar conta</Link></p>
        </form>
      </div>
    </div>
  )
}
