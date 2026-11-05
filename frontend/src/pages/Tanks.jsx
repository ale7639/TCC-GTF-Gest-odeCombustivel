import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { apiMessage, liters } from '../utils/format'

export default function Tanks() {
  const { isGestao } = useAuth()
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  function carregar() {
    return api.get('/tanques').then(({ data }) => setLista(data))
  }
  useEffect(() => { carregar().catch(() => setError('Falha ao carregar tanques.')) }, [])

  async function salvar(event) {
    event.preventDefault()
    setError('')
    try {
      if (form.id) await api.put(`/tanques/${form.id}`, form)
      else await api.post('/tanques', form)
      setForm(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <div className="row space">
        <div>
          <p className="eyebrow">Base</p>
          <h1>Tanques</h1>
        </div>
        {isGestao && <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setForm({ nome: '', tipo_combustivel: 'Diesel S10', capacidade: '', nivel_atual: 0 })}>Novo</button>}
      </div>
      <p className="muted">Diesel, gasolina ou o que a base tiver. Cada tanque tem o próprio saldo.</p>
      {error && <div className="banner banner-danger">{error}</div>}
      {lista.length === 0 && <EmptyState icon="🛢️" title="Nenhum tanque" text="Cadastre o tanque principal da base." />}
      {lista.map((t) => (
        <Link key={t.id} to={`/app/tanques/${t.id}`} className={`tank ${t.alerta ? 'critical' : ''}`} style={{ textDecoration: 'none' }}>
          <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>{t.tipo_combustivel}</p>
          <h2 style={{ color: '#fff' }}>{t.nome}</h2>
          <div className="num">{liters(t.nivel_atual)}</div>
          <p style={{ opacity: .8 }}>{t.percentual}% de {liters(t.capacidade)}</p>
          <div className="progress"><span style={{ width: `${Math.min(100, t.percentual)}%` }} /></div>
        </Link>
      ))}
      {form && (
        <form className="card stack" onSubmit={salvar}>
          <h2>Novo tanque na base</h2>
          <div className="field"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
          <div className="field">
            <label>Combustível</label>
            <select value={form.tipo_combustivel} onChange={(e) => setForm({ ...form, tipo_combustivel: e.target.value })}>
              <option>Diesel S10</option>
              <option>Diesel S500</option>
              <option>Gasolina</option>
              <option>Arla 32</option>
            </select>
          </div>
          <div className="field"><label>Capacidade (L)</label><input type="number" value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} required /></div>
          <div className="field"><label>Nível inicial (L)</label><input type="number" value={form.nivel_atual} onChange={(e) => setForm({ ...form, nivel_atual: e.target.value })} /></div>
          <button className="btn btn-primary">Salvar</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
    </div>
  )
}
