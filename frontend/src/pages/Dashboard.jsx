import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { dateBr, firstName, liters } from '../utils/format'

export default function Dashboard() {
  const { user, isGestao } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/dashboard').then(({ data: d }) => setData(d)).catch(() => setError('Não foi possível carregar o painel.'))
  }, [])

  if (error) return <div className="scroll"><div className="banner banner-danger">{error}</div></div>
  if (!data) return <div className="scroll"><p className="muted">Carregando…</p></div>

  return (
    <div className="scroll stack">
      <header className="page-head">
        <p className="eyebrow">Hoje no pátio</p>
        <h1>Olá, {firstName(user?.name)}</h1>
      </header>

      <section className="stack" aria-label="Tanques">
        {data.tanques.map((tanque) => (
          <Link
            key={tanque.id}
            to={`/app/tanques/${tanque.id}`}
            className={`tank ${tanque.alerta ? 'critical' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>
              {tanque.nome} · {tanque.tipo_combustivel}
            </p>
            <div className="num">{liters(tanque.nivel_atual)}</div>
            <p style={{ margin: '6px 0 0', opacity: .8 }}>{tanque.percentual}% da capacidade</p>
            <div className="progress"><span style={{ width: `${Math.min(100, tanque.percentual)}%` }} /></div>
          </Link>
        ))}
      </section>

      <div className="kpi">
        <div className="kpi-card"><div className="num">{data.caminhoes.ativos}</div><span>Caminhões ativos</span></div>
        <div className="kpi-card"><div className="num">{data.caminhoes.disponibilidade_pct != null ? `${data.caminhoes.disponibilidade_pct}%` : '—'}</div><span>Disponibilidade</span></div>
        <div className="kpi-card"><div className="num">{data.abastecimentos_hoje}</div><span>Abastecimentos hoje</span></div>
        <div className="kpi-card"><div className="num">{liters(data.litros_hoje)}</div><span>Litros hoje</span></div>
      </div>

      {/* Um CTA principal; o restante como links leves para menos ruído. */}
      <div className="stack dash-actions">
        <Link className="btn btn-fuel" to="/app/abastecer">Registrar abastecimento</Link>
        <div className="row dash-links">
          <Link className="link" to="/app/saida">Checklist de saída</Link>
          {isGestao && <Link className="link" to="/app/relatorios">Relatórios</Link>}
        </div>
      </div>

      <section className="stack">
        <h2>Últimos abastecimentos</h2>
        <div className="list">
          {data.ultimos_abastecimentos.length === 0 && <p className="muted">Nenhum abastecimento ainda.</p>}
          {data.ultimos_abastecimentos.map((item) => (
            <div key={item.id} className="list-item">
              <div className="truck-thumb">{item.placa?.slice(0, 3)}</div>
              <div className="grow">
                <strong className="plate" style={{ fontSize: 18 }}>{item.placa}</strong>
                <p className="muted" style={{ margin: 0 }}>{dateBr(item.data)} · {item.origem === 'externo' ? 'Posto' : item.tanque}</p>
              </div>
              <strong>{liters(item.litros)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
