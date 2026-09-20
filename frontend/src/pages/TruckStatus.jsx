import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'

export default function TruckStatus() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get(`/trucks/${id}/status`).then(({ data }) => setData(data.data))
  }, [id])

  if (!data) return <div className="scroll"><p className="muted">Carregando status...</p></div>

  const ok = data.result === 'apto'

  return (
    <div className="scroll">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      <div className="stat-hero">
        <div className={`flag ${ok ? 'ok' : 'bad'}`}>{ok ? 'APTO — Pronto para escala' : 'NÃO APTO'}</div>
        <h1 style={{ marginTop: 16 }}>{data.plate}</h1>
        <p className="muted">{data.model}</p>
        <p className="muted">
          {data.verified_by ? `Verificado por ${data.verified_by}` : 'Ainda sem verificação registrada'}
        </p>
      </div>
      {!ok && data.pending_items?.length > 0 && (
        <div className="card">
          {data.pending_items.map((item) => (
            <p key={item.key}><strong>{item.label}</strong> · {item.detail}</p>
          ))}
        </div>
      )}
      <Link className="btn btn-soft" to={`/app/frota/${id}`}>Ver detalhes</Link>
    </div>
  )
}
