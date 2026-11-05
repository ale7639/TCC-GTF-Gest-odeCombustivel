import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiMessage, digitsOnly, maskCpf } from '../utils/format'

/**
 * Login unificado: gestão com e-mail; motorista com CPF.
 * Sem atalhos de papel — o backend decide pelo conteúdo do campo.
 */
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const seemsCpf = useMemo(() => {
    const d = digitsOnly(loginValue)
    return d.length > 0 && /^\d+$/.test(loginValue.replace(/[.\-\s]/g, '')) && d.length <= 11
      && !loginValue.includes('@')
  }, [loginValue])

  function onLoginChange(raw) {
    if (raw.includes('@')) {
      setLoginValue(raw)
      return
    }
    const d = digitsOnly(raw)
    // Digitando só números → máscara de CPF; senão texto livre (e-mail parcial).
    if (d.length > 0 && d.length <= 11 && /^[\d.\-\s]*$/.test(raw)) {
      setLoginValue(maskCpf(d))
      return
    }
    setLoginValue(raw)
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginValue.trim(), password)
      navigate('/app')
    } catch (err) {
      setError(apiMessage(err, 'Credenciais inválidas.'))
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
        <p>Gestão usa e-mail. Motorista entra com o CPF cadastrado e a senha.</p>
      </div>
      <div className="scroll">
        <form className="stack auth-form" onSubmit={submit}>
          {error && <div className="banner banner-danger" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="login">{seemsCpf ? 'CPF' : 'E-mail ou CPF'}</label>
            <input
              id="login"
              type="text"
              inputMode={seemsCpf ? 'numeric' : 'email'}
              autoComplete="username"
              placeholder={seemsCpf ? '000.000.000-00' : 'e-mail ou CPF'}
              value={loginValue}
              onChange={(e) => onLoginChange(e.target.value)}
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
