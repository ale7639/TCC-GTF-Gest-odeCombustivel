import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, dateBr } from '../utils/format'

export default function Wash() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get(`/trucks/${id}/washes`)
    setData(data)
  }

  useEffect(() => { load() }, [id])

  async function mark() {
    setError('')
    try {
      await api.post(`/trucks/${id}/washes`)
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Selecione um veículo para registrar a lavagem.'))
    }
  }

  if (!data) return <div className="scroll"><p className="muted">Carregando lavagem...</p></div>

  return (
    <div className="scroll">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      <h1>Controle de lavagem</h1>
      <p className="muted">{data.truck.plate} · frequência {data.truck.wash_frequency_days} dias</p>
      {error && <div className="banner banner-danger">{error}</div>}
      <div className="card" style={{ marginTop: 12 }}>
        <p><strong>Última lavagem</strong><br />{data.last ? new Date(data.last.washed_at).toLocaleString('pt-BR') : 'Nunca'}</p>
        <p className="muted">{data.days_since != null ? `Há ${data.days_since} dia(s)` : 'Sem registro'}</p>
        <p>Próxima: {dateBr(data.next_due)}</p>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={mark}>Marcar como lavado</button>
      {data.history?.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Histórico</h2>
          <div className="list" style={{ marginTop: 10 }}>
            {data.history.map((item) => (
              <div className="list-item" key={item.id}>
                <div className="grow">
                  <strong>{new Date(item.washed_at).toLocaleString('pt-BR')}</strong>
                  <div className="muted">{item.user?.name}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
