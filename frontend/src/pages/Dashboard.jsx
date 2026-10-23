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

  const alertas = data.alertas || []

  return (
    <div className="scroll stack">
      <div>
        <p className="eyebrow">Hoje no pátio</p>
        <h1>Olá, {firstName(user?.name)}</h1>
      </div>
      {alertas.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          {alertas.slice(0, 6).map((a, i) => (
            <Link
              key={`${a.tipo}-${i}`}
              to={a.link || '/app'}
              className={`banner ${a.nivel === 'vencido' ? 'banner-danger' : 'banner-warn'}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <strong>{a.titulo}</strong>
              <div style={{ marginTop: 4 }}>{a.texto}</div>
            </Link>
          ))}
        </div>
      )}
      {data.tanques.map((tanque) => (
        <Link key={tanque.id} to={`/app/tanques/${tanque.id}`} className={`tank ${tanque.alerta ? 'critical' : ''}`} style={{ textDecoration: 'none' }}>
          <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>{tanque.nome} · {tanque.tipo_combustivel}</p>
          <div className="num">{liters(tanque.nivel_atual)}</div>
          <p style={{ margin: '6px 0 0', opacity: .8 }}>{tanque.percentual}% da capacidade</p>
          <div className="progress"><span style={{ width: `${Math.min(100, tanque.percentual)}%` }} /></div>
          {tanque.alerta && <p style={{ margin: '12px 0 0', fontWeight: 700 }}>Nível crítico — registre uma entrada.</p>}
        </Link>
      ))}
      <div className="kpi">
        <div className="kpi-card"><div className="num">{data.caminhoes.ativos}</div><span>Caminhões ativos</span></div>
        <div className="kpi-card"><div className="num">{data.caminhoes.disponibilidade_pct != null ? `${data.caminhoes.disponibilidade_pct}%` : '—'}</div><span>Disponibilidade</span></div>
        <div className="kpi-card"><div className="num">{data.abastecimentos_hoje}</div><span>Abastecimentos hoje</span></div>
        <div className="kpi-card"><div className="num">{liters(data.litros_hoje)}</div><span>Litros hoje</span></div>
      </div>
      <Link className="btn btn-fuel" to="/app/abastecer">Registrar abastecimento</Link>
      <Link className="btn btn-soft" to="/app/saida">Checklist de saída</Link>
      {isGestao && <Link className="btn btn-soft" to="/app/relatorios">Abrir relatórios da gestão</Link>}
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
    </div>
  )
}
