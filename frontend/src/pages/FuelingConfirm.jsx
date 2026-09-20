import { Link, Navigate, useLocation } from 'react-router-dom'
import { liters } from '../utils/format'

export default function FuelingConfirm() {
  const { state } = useLocation()
  if (!state) return <Navigate to="/app/abastecer" replace />

  return (
    <div className="scroll">
      <div className="stat-hero">
        <div className="flag ok">✓ Registro salvo</div>
        <h1 style={{ marginTop: 16 }}>{state.quantity} L</h1>
        <p className="muted">{state.truck}</p>
      </div>
      <div className="card">
        <p><strong>Nível antes</strong><br />{liters(state.level_before)} ({state.percent_before}%)</p>
        <p><strong>Nível após</strong><br />{liters(state.level_after)} ({state.percent_after}%)</p>
        <p><strong>Responsável</strong><br />{state.responsible}</p>
        <p><strong>Data/hora</strong><br />{state.created_at}</p>
      </div>
      <div className="stack" style={{ marginTop: 16 }}>
        <Link className="btn btn-primary" to="/app">Ir para Dashboard</Link>
        <Link className="btn btn-soft" to="/app/abastecer">Novo abastecimento</Link>
      </div>
    </div>
  )
}
