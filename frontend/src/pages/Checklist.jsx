import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function Checklist() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get(`/trucks/${id}/checklist`).then(({ data }) => setData(data.data))
  }, [id])

  if (!data) return <div className="scroll"><p className="muted">Carregando checklist...</p></div>

  const items = Object.values(data.checklist.items)

  return (
    <div className="scroll">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      <p className="eyebrow">Checklist</p>
      <h1>{data.truck.plate}</h1>
      <p className="muted">{data.truck.model}</p>
      <div className="card" style={{ marginTop: 16 }}>
        {items.map((item) => (
          <div className="check-item" key={item.key}>
            <div className={`status-icon ${item.status}`} aria-hidden="true">{item.status === 'ok' ? '✓' : '!'}</div>
            <div>
              <strong>{item.label}</strong>
              <div className="muted">{item.detail}</div>
              <span className="sr-only">{item.status === 'ok' ? 'Em dia' : 'Pendente'}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`banner ${data.checklist.ready ? 'banner-ok' : 'banner-warn'}`} style={{ marginTop: 12 }}>
        {data.checklist.label}
      </div>
      {isAdmin && data.checklist.items.documentacao?.status !== 'ok' && (
        <Link className="btn btn-soft" style={{ marginTop: 12 }} to={`/app/frota/${id}/editar`}>Atualizar CRLV, seguro e licenciamento</Link>
      )}
      <Link className="btn btn-primary" style={{ marginTop: 12 }} to={`/app/frota/${id}/status`}>Ver status final</Link>
    </div>
  )
}
