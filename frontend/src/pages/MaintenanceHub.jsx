import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { apiMessage, dateBr, km, oleoBadge, oleoLabel } from '../utils/format'

export default function MaintenanceHub() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/manutencao')
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(apiMessage(err)))
  }, [])

  if (error) return <div className="scroll"><div className="banner banner-danger">{error}</div></div>
  if (!data) return <div className="scroll"><p className="muted">Carregando…</p></div>

  const { caminhoes, resumo } = data

  return (
    <div className="scroll stack">
      <div>
        <p className="eyebrow">Oficina / pátio</p>
        <h1>Manutenção</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Óleo, ordens de serviço e histórico por caminhão.
        </p>
      </div>

      <div className="kpi">
        <div className="kpi-card"><div className="num">{resumo.atrasados}</div><span>Óleo atrasado</span></div>
        <div className="kpi-card"><div className="num">{resumo.proximos}</div><span>Óleo próximo</span></div>
        <div className="kpi-card"><div className="num">{resumo.os_abertas ?? 0}</div><span>OS abertas</span></div>
        <div className="kpi-card"><div className="num">{caminhoes.length}</div><span>Na frota</span></div>
      </div>

      {caminhoes.length === 0 ? (
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
    </div>
  )
}
