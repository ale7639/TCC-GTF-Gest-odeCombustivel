import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { apiMessage } from '../utils/format'

export default function Notifications() {
  const navigate = useNavigate()
  const [itens, setItens] = useState([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    setLoading(true)
    return api.get('/notificacoes')
      .then(({ data }) => {
        setItens(data.itens || [])
        setNaoLidas(data.nao_lidas || 0)
        setError('')
      })
      .catch(() => setError('Não foi possível carregar as notificações.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function marcarUma(chave, link) {
    try {
      await api.post('/notificacoes/ler', { chave })
      window.dispatchEvent(new Event('gfc:notificacoes'))
      if (link) navigate(link)
      else await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  async function marcarTodas() {
    try {
      await api.post('/notificacoes/ler-todas')
      window.dispatchEvent(new Event('gfc:notificacoes'))
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <div className="row space">
        <div>
          <p className="eyebrow">Caixa de entrada</p>
          <h1>Notificações</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {naoLidas > 0 ? `${naoLidas} não lida${naoLidas === 1 ? '' : 's'}` : 'Tudo lido por enquanto'}
          </p>
        </div>
        {naoLidas > 0 && (
          <button type="button" className="btn btn-soft" style={{ width: 'auto' }} onClick={marcarTodas}>
            Marcar todas
          </button>
        )}
      </div>

      {error && <div className="banner banner-danger">{error}</div>}
      {loading && <p className="muted">Carregando…</p>}

      {!loading && itens.length === 0 && (
        <div className="empty">
          <div className="illus" aria-hidden="true">✓</div>
          <h2>Nenhum alerta</h2>
          <p className="muted">Documentos, óleo, consumo e tanque aparecem aqui quando precisarem de atenção.</p>
        </div>
      )}

      <div className="list">
        {itens.map((n) => (
          <button
            key={n.chave}
            type="button"
            className={`list-item list-item-stack notif-item ${n.lida ? 'lida' : 'nova'}`}
            onClick={() => marcarUma(n.chave, n.link)}
          >
            <div className="row space" style={{ width: '100%' }}>
              <div className="grow" style={{ textAlign: 'left' }}>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  {!n.lida && <span className="notif-dot" aria-hidden="true" />}
                  <strong>{n.titulo}</strong>
                </div>
                <p className="muted" style={{ margin: 0, textAlign: 'left' }}>{n.texto}</p>
              </div>
              <span className={`badge ${n.nivel === 'vencido' ? 'badge-nao_apto' : 'badge-pendente'}`}>
                {n.nivel === 'vencido' ? 'Urgente' : 'Atenção'}
              </span>
            </div>
            {n.link && (
              <span className="link" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                Abrir →
              </span>
            )}
          </button>
        ))}
      </div>

      <Link className="btn btn-soft" to="/app">Voltar ao início</Link>
    </div>
  )
}
