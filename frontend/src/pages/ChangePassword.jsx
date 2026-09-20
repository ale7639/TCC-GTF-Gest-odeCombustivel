import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, fieldError } from '../utils/format'
import { passwordScore } from '../utils/password'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const strength = useMemo(() => passwordScore(password), [password])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setOk('')
    setLoading(true)
    try {
      const { data } = await api.put('/password', {
        current_password: currentPassword,
        password,
        password_confirmation: confirmation,
      })
      setOk(data.message)
      setCurrentPassword('')
      setPassword('')
      setConfirmation('')
    } catch (err) {
      setError(fieldError(err, 'current_password') || fieldError(err, 'password') || apiMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="scroll">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      <h1>Trocar senha</h1>
      <p className="muted">A senha atual é exigida. A nova precisa de 8 caracteres, maiúscula e número.</p>
      <form className="stack" style={{ marginTop: 16 }} onSubmit={submit}>
        {error && <div className="banner banner-danger">{error}</div>}
        {ok && <div className="banner banner-ok">{ok}</div>}
        <div className="field">
          <label>Senha atual</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
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
      </form>
    </div>
  )
}
