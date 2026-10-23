import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import { apiMessage, dateBr, money } from '../utils/format'

export default function Wash() {
  const { id } = useParams()
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')
  const [ask, setAsk] = useState(false)

  function carregar() {
    return api.get(`/caminhoes/${id}/lavagens`).then(({ data }) => setLista(data))
  }
  useEffect(() => { carregar().catch((err) => setError(apiMessage(err))) }, [id])

  async function registrar() {
    setAsk(false)
    try {
      await api.post(`/caminhoes/${id}/lavagens`, { data: new Date().toISOString().slice(0, 10), valor: 0 })
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <Link className="link" to={`/app/frota/${id}`}>← Caminhão</Link>
      <h1>Lavagem</h1>
      {error && <div className="banner banner-danger">{error}</div>}
      <button className="btn btn-primary" onClick={() => setAsk(true)}>Marcar lavado agora</button>
      {lista.map((l) => (
        <div key={l.id} className="card">
          <strong>{dateBr(l.data)}</strong>
          <p className="muted" style={{ margin: 0 }}>{l.motorista?.nome} · {money(l.valor)}</p>
        </div>
      ))}
      {ask && <Confirm title="Registrar lavagem?" text="A data será hoje." onCancel={() => setAsk(false)} onConfirm={registrar} />}
    </div>
  )
}
