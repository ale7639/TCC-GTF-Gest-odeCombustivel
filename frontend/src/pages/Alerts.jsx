import { useEffect, useState } from 'react'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { apiMessage } from '../utils/format'
import { useAuth } from '../context/AuthContext'

const icons = {
  manutencao_vencida: '🛠️',
  lavagem_atrasada: '🚿',
  combustivel_baixo: '⛽',
  documentacao_vencer: '📄',
}

export default function Alerts() {
  const { canManage } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      const { data } = await api.get('/alerts')
      setData(data)
      setError('')
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível carregar os alertas.'))
    }
  }

  useEffect(() => {
    async function start() {
      if (canManage) {
        try { await api.post('/alerts/generate') } catch {}
      }
      await load()
    }
    start()
  }, [canManage])

  async function read(id) {
    await api.post(`/alerts/${id}/read`)
    await load()
  }

  if (!data && !error) return <div className="scroll"><p className="muted">Carregando alertas...</p></div>

  return (
    <div className="scroll">
      <div className="topbar">
        <h1>Alertas</h1>
        {data?.unread > 0 && (
          <button className="btn btn-ghost" onClick={async () => { await api.post('/alerts/read-all'); await load() }}>
            Marcar todos
          </button>
        )}
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      {data && data.data.length === 0 ? (
        <EmptyState icon="🔔" title="Nenhum alerta no momento" text="Quando houver manutenção, lavagem, combustível ou documentação pendente, aparece aqui." />
      ) : (
        <div className="list">
          {data?.data.map((alert) => (
            <button key={alert.id} className="list-item" onClick={() => read(alert.id)} style={{ textAlign: 'left' }}>
              <div className="truck-thumb">{icons[alert.type] || '•'}</div>
              <div className="grow">
                <strong>{alert.title}</strong>
                <div className="muted">{alert.description}</div>
              </div>
              <span className="muted">{alert.relative}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
