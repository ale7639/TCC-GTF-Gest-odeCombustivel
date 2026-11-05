import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { km, kmPerLiter, statusBadge, statusLabel } from '../utils/format'

export default function Fleet() {
  const { isAdmin } = useAuth()
  const [lista, setLista] = useState([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const params = {}
    if (q) params.q = q
    if (status) params.status = status
    api.get('/caminhoes', { params }).then(({ data }) => setLista(data)).catch(() => setLista([]))
  }, [q, status])

  return (
    <div className="scroll stack">
      <div className="row space">
        <div>
          <p className="eyebrow">Operação</p>
          <h1>Frota</h1>
        </div>
        {isAdmin && <Link className="btn btn-primary" style={{ width: 'auto', padding: '10px 14px' }} to="/app/frota/novo">Novo</Link>}
      </div>
      <input className="search" placeholder="Buscar placa ou modelo" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters">
        {['', 'ativo', 'manutencao', 'inativo'].map((s) => (
          <button key={s || 'all'} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>
            {s ? statusLabel(s) : 'Todos'}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <EmptyState icon="🚛" title="Nenhum caminhão" text="Ajuste a busca ou cadastre a frota." />
      ) : (
        <div className="list">
          {lista.map((c) => (
            <Link key={c.id} className="list-item" to={`/app/frota/${c.id}`}>
              <div className="truck-thumb">{c.placa.slice(0, 3)}</div>
              <div className="grow">
                <div className="plate">{c.placa}</div>
                <p className="muted" style={{ margin: '4px 0 0' }}>{c.modelo} · {c.motorista?.nome || 'Sem motorista'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${statusBadge(c.status)}`}>{statusLabel(c.status)}</span>
                <p className="muted" style={{ margin: '6px 0 0' }}>{kmPerLiter(c.media_km_l)}</p>
                <p className="muted" style={{ margin: 0 }}>{km(c.km_atual)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
