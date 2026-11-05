import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, km, oleoBadge, oleoLabel } from '../utils/format'

export default function MaintenanceHub() {
  const { isMotorista } = useAuth()
  const [data, setData] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/manutencao')
      .then(async ({ data: d }) => {
        setData(d)
        // Lista recente de OS (histórico embaixo da ação).
        const trucks = d.caminhoes || []
        if (trucks.length === 0) {
          setRecentes([])
          return
        }
        const listas = await Promise.all(
          trucks.slice(0, isMotorista ? 1 : 5).map((c) =>
            api.get(`/caminhoes/${c.id}/manutencoes`)
              .then(({ data: payload }) => {
                const lista = Array.isArray(payload) ? payload : (payload?.historico || [])
                return lista.map((m) => ({
                  ...m,
                  _placa: c.placa,
                  caminhao_id: m.caminhao_id || c.id,
                }))
              })
              .catch(() => [])
          )
        )
        const flat = listas.flat().sort((a, b) => {
          const da = String(a.data_prevista || a.data || '')
          const db = String(b.data_prevista || b.data || '')
          return db.localeCompare(da) || (b.id - a.id)
        })
        setRecentes(flat.slice(0, 20))
      })
      .catch((err) => setError(apiMessage(err)))
  }, [isMotorista])

  if (error) return <div className="scroll"><div className="banner banner-danger">{error}</div></div>
  if (!data) return <div className="scroll"><p className="muted">Carregando…</p></div>

  const { caminhoes, resumo } = data
  const unico = isMotorista && caminhoes.length === 1 ? caminhoes[0] : null

  return (
    <div className="scroll stack">
      <div>
        <p className="eyebrow">Oficina / pátio</p>
        <h1>Manutenção</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          {isMotorista
            ? 'Acompanhe óleo e ordens do seu caminhão.'
            : 'Óleo, ordens de serviço e histórico por caminhão.'}
        </p>
      </div>

      {!isMotorista && (
        <div className="kpi">
          <div className="kpi-card"><div className="num">{resumo.atrasados}</div><span>Óleo atrasado</span></div>
          <div className="kpi-card"><div className="num">{resumo.proximos}</div><span>Óleo próximo</span></div>
          <div className="kpi-card"><div className="num">{resumo.os_abertas ?? 0}</div><span>OS abertas</span></div>
          <div className="kpi-card"><div className="num">{caminhoes.length}</div><span>Na frota</span></div>
        </div>
      )}

      {unico ? (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="row space">
            <div>
              <p className="eyebrow">Seu caminhão</p>
              <strong className="plate" style={{ fontSize: 22 }}>{unico.placa}</strong>
              <p className="muted" style={{ margin: '4px 0 0' }}>{unico.modelo} · {km(unico.km_atual)}</p>
            </div>
            <span className={`badge ${oleoBadge(unico.oleo?.alerta)}`}>{oleoLabel(unico.oleo?.alerta)}</span>
          </div>
          <Link className="btn btn-primary" to={`/app/frota/${unico.id}/manutencao`}>
            Ver / registrar manutenção
          </Link>
        </div>
      ) : caminhoes.length === 0 ? (
        <EmptyState icon="🔧" title="Nada na frota" text="Cadastre caminhões para acompanhar manutenção." />
      ) : (
        <div className="list">
          {caminhoes.map((c) => (
            <Link key={c.id} className="list-item list-item-stack" to={`/app/frota/${c.id}/manutencao`}>
              <div className="row space" style={{ width: '100%' }}>
                <div className="row" style={{ minWidth: 0 }}>
                  <div className="truck-thumb">{c.placa.slice(0, 3)}</div>
                  <div className="grow">
                    <div className="plate" style={{ fontSize: 20 }}>{c.placa}</div>
                    <p className="muted truncate" style={{ margin: '4px 0 0' }}>
                      {c.modelo} · {km(c.km_atual)}
                    </p>
                  </div>
                </div>
                <span className={`badge ${oleoBadge(c.oleo?.alerta)}`}>{oleoLabel(c.oleo?.alerta)}</span>
              </div>
              <div className="mini" style={{ width: '100%', marginTop: 10 }}>
                <div>
                  <span>Última troca</span>
                  <strong>{dateBr(c.oleo?.ultima_data)}</strong>
                </div>
                <div>
                  <span>Próxima (km)</span>
                  <strong>{c.oleo?.proxima_km != null ? km(c.oleo.proxima_km) : '—'}</strong>
                </div>
              </div>
              {c.agendadas?.length > 0 && (
                <p className="muted" style={{ margin: '8px 0 0', width: '100%' }}>
                  OS: {c.agendadas[0].tipo} · {c.agendadas[0].status} · {dateBr(c.agendadas[0].data_prevista || c.agendadas[0].data)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <section className="stack">
        <h2>Últimas manutenções</h2>
        {recentes.length === 0 && <p className="muted">Nenhuma ordem de serviço ainda.</p>}
        <div className="list">
          {recentes.map((m) => (
            <Link
              key={m.id}
              className="list-item"
              to={`/app/frota/${m.caminhao_id || unico?.id}/manutencao`}
            >
              <div className="grow">
                <strong>{m.tipo}</strong>
                <p className="muted" style={{ margin: 0 }}>
                  {m._placa || '—'} · {dateBr(m.data_prevista || m.data)} · {m.oficina || '—'}
                </p>
              </div>
              <span className={`badge ${m.status === 'fechado' || m.status === 'concluida' ? 'badge-ok' : 'badge-pendente'}`}>
                {m.status}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Link className="link" to="/app">← Painel</Link>
    </div>
  )
}
