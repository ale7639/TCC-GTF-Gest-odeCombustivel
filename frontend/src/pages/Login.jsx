import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { apiMessage, digitsOnly, maskCpf } from '../utils/format'

/**
 * Login unificado: gestão com e-mail; motorista com CPF + senha (= CPF por padrão).
 */
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loginValue, setLoginValue] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [forgotCpf, setForgotCpf] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [forgotErr, setForgotErr] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

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

  async function pedirSenha(event) {
    event.preventDefault()
    setForgotMsg('')
    setForgotErr('')
    setForgotLoading(true)
    try {
      const { data } = await api.post('/senha/esqueci', { cpf: forgotCpf })
      setForgotMsg(data.message || 'Se o CPF estiver cadastrado, o administrador receberá o pedido.')
    } catch (err) {
      const status = err?.response?.status
      if (status === 429) {
        setForgotErr('Muitas tentativas. Aguarde um minuto e tente de novo.')
      } else {
        // Mesmo em erro de rede, não vaza se o CPF existe — mas não finja sucesso.
        setForgotErr(apiMessage(err, 'Não foi possível enviar o pedido. Tente novamente.'))
      }
    } finally {
      setForgotLoading(false)
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
        <p>Gestão usa e-mail. Motorista entra com CPF; a senha inicial é o CPF (só números).</p>
      </div>
      <div className="scroll">
        {!forgot ? (
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
            <button
              type="button"
              className="link"
              style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
              onClick={() => {
                setForgot(true)
                setForgotMsg('')
                setForgotErr('')
                setForgotCpf(seemsCpf ? loginValue : '')
              }}
            >
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form className="stack auth-form" onSubmit={pedirSenha}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Esqueci minha senha</h2>
            <p className="muted" style={{ margin: 0 }}>
              Informe o CPF do motorista. O administrador recebe o pedido no sino de notificações.
            </p>
            {forgotMsg && <div className="banner banner-ok" role="status">{forgotMsg}</div>}
            {forgotErr && <div className="banner banner-danger" role="alert">{forgotErr}</div>}
            <div className="field">
              <label htmlFor="forgot-cpf">CPF</label>
              <input
                id="forgot-cpf"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={forgotCpf}
                onChange={(e) => setForgotCpf(maskCpf(digitsOnly(e.target.value)))}
                required
              />
            </div>
            <button className="btn btn-primary" disabled={forgotLoading}>
              {forgotLoading ? 'Enviando…' : 'Pedir nova senha'}
            </button>
            <button type="button" className="btn btn-soft" onClick={() => setForgot(false)}>
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
