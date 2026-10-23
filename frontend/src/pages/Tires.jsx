import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, km, oleoBadge, oleoLabel } from '../utils/format'

const POS = ['DE', 'DD', 'TE', 'TD', 'EE1', 'ED1', 'EE2', 'ED2', 'estepe']

export default function Tires() {
  const { id } = useParams()
  const { isGestao } = useAuth()
  const [lista, setLista] = useState([])
  const [placa, setPlaca] = useState('')
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  function carregar() {
    return Promise.all([
      api.get(`/caminhoes/${id}/pneus`),
      api.get(`/caminhoes/${id}`),
    ]).then(([p, c]) => {
      setLista(p.data)
      setPlaca(c.data.placa)
    })
  }

  useEffect(() => { carregar().catch((e) => setError(apiMessage(e))) }, [id])

  async function salvar(e) {
    e.preventDefault()
    setError('')
    try {
      await api.post(`/caminhoes/${id}/pneus`, form)
      setForm(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <Link className="link" to={`/app/frota/${id}`}>← {placa || 'Caminhão'}</Link>
      <h1>Pneus</h1>
      <p className="muted">Posição, última troca e alerta simples por KM.</p>
      {error && <div className="banner banner-danger">{error}</div>}
      {isGestao && !form && (
        <button className="btn btn-primary" onClick={() => setForm({
          posicao: 'DE', data_troca: new Date().toISOString().slice(0, 10), km_troca: '', intervalo_km: 60000, observacao: '',
        })}>
          Registrar troca
        </button>
      )}
      {form && (
        <form className="card stack" onSubmit={salvar}>
          <div className="field">
            <label>Posição</label>
            <select value={form.posicao} onChange={(e) => setForm({ ...form, posicao: e.target.value })}>
              {POS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field"><label>Data da troca</label><input type="date" value={form.data_troca} onChange={(e) => setForm({ ...form, data_troca: e.target.value })} /></div>
          <div className="field"><label>KM na troca</label><input type="number" value={form.km_troca} onChange={(e) => setForm({ ...form, km_troca: e.target.value })} /></div>
          <div className="field"><label>Intervalo (km)</label><input type="number" value={form.intervalo_km} onChange={(e) => setForm({ ...form, intervalo_km: e.target.value })} /></div>
          <button className="btn btn-primary">Salvar</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
      {lista.length === 0 && <p className="muted">Nenhum pneu cadastrado.</p>}
      {lista.map((p) => (
        <div key={p.id} className="list-item">
          <div className="grow">
            <strong>{p.posicao}</strong>
            <p className="muted" style={{ margin: 0 }}>
              Troca {dateBr(p.data_troca)} · {km(p.km_troca)} · próxima {p.proxima_km != null ? km(p.proxima_km) : '—'}
            </p>
          </div>
          <span className={`badge ${oleoBadge(p.alerta)}`}>{oleoLabel(p.alerta)}</span>
        </div>
      ))}
    </div>
  )
}
