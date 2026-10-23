import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, km, money } from '../utils/format'

export default function Maintenance() {
  const { id } = useParams()
  const { isGestao } = useAuth()
  const [lista, setLista] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  function carregar() {
    return api.get(`/caminhoes/${id}/manutencoes`).then(({ data }) => setLista(data))
  }
  useEffect(() => { carregar().catch((err) => setError(apiMessage(err))) }, [id])

  async function salvar(event) {
    event.preventDefault()
    setError('')
    try {
      await api.post(`/caminhoes/${id}/manutencoes`, form)
      setForm(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <Link className="link" to={`/app/frota/${id}`}>← Caminhão</Link>
      <div className="row space">
        <h1>Manutenção</h1>
        {isGestao && <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setForm({ data: new Date().toISOString().slice(0, 10), tipo: '', valor: '', km: '' })}>Nova</button>}
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      {lista.map((m) => (
        <div key={m.id} className="card">
          <strong>{m.tipo}</strong>
          <p className="muted" style={{ margin: 0 }}>{dateBr(m.data)} · {km(m.km)} · {money(m.valor)}</p>
        </div>
      ))}
      {form && (
        <form className="card stack" onSubmit={salvar}>
          <div className="field"><label>Data</label><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></div>
          <div className="field"><label>Tipo</label><input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} required /></div>
          <div className="field"><label>KM</label><input type="number" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} required /></div>
          <div className="field"><label>Valor</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
          <button className="btn btn-primary">Salvar</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
    </div>
  )
}
