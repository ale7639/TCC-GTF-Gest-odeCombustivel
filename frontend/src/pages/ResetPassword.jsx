import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { apiMessage } from '../utils/format'
import { passwordScore } from '../utils/password'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const strength = useMemo(() => passwordScore(password), [password])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/reset-password', {
        token: params.get('token'),
        email: params.get('email'),
        password,
        password_confirmation: confirmation,
      })
      navigate('/login')
    } catch (err) {
      setError(apiMessage(err, 'Este link expirou. Solicite um novo link de recuperação.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-screen">
      <div className="hero-auth">
        <h1>Nova senha</h1>
        <p>Defina uma senha forte, diferente da anterior.</p>
      </div>
      <div className="scroll auth-scroll">
        <form className="stack" onSubmit={submit}>
          {error && <div className="banner banner-danger">{error}</div>}
          <div className="field">
            <label>Nova senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="strength">
              <div className="strength-bar"><span style={{ width: strength.width, background: strength.color }} /></div>
              <span className="hint">{strength.label}</span>
            </div>
          </div>
          <div className="field">
            <label>Confirmar nova senha</label>
            <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={loading || !strength.valid}>{loading ? 'Salvando...' : 'Salvar senha'}</button>
          <Link className="link" to="/recuperar-senha">Solicitar novo link</Link>
        </form>
      </div>
    </div>
  )
}
