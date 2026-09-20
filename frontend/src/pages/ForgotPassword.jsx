import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      await api.post('/forgot-password', { email })
    } finally {
      setDone(true)
      setLoading(false)
    }
  }

  return (
    <div className="app-screen">
      <div className="hero-auth">
        <h1>Recuperar senha</h1>
        <p>Informe o e-mail cadastrado. Se ele existir, enviaremos um link válido por 1 hora.</p>
      </div>
      <div className="scroll auth-scroll">
        {done ? (
          <div className="stack">
            <div className="banner banner-ok">Se o e-mail estiver cadastrado, enviaremos um link de recuperação.</div>
            <Link className="btn btn-primary" to="/login">Voltar ao login</Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Enviando...' : 'Enviar link de recuperação'}</button>
            <Link className="link" to="/login">Voltar ao login</Link>
          </form>
        )}
      </div>
    </div>
  )
}
