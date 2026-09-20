import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import api from '../api/client'
import TankGauge from '../components/TankGauge'
import { apiMessage, firstName, liters } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { unread } = useOutletContext()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refill, setRefill] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      const { data } = await api.get('/dashboard')
      setData(data)
      setError('')
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível carregar o painel.'))
    }
  }

  useEffect(() => { load() }, [])

  async function refillTank(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/tank/refill', { quantity: Number(refill) })
      setRefill('')
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível reabastecer o tanque central.'))
    } finally {
      setSaving(false)
    }
  }

  if (!data && !error) return <div className="scroll"><p className="muted">Carregando painel...</p></div>

  return (
    <div className="scroll">
      <div className="topbar">
        <div>
          <p className="eyebrow">Operação de hoje</p>
          <h1>Olá, {firstName(user?.name)}</h1>
        </div>
        <Link to="/app/alertas" className="btn-icon" aria-label="Alertas">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
            <path d="M10 20a2 2 0 0 0 4 0" />
          </svg>
          {unread > 0 && <span className="bell-count">{unread}</span>}
        </Link>
      </div>

      <div className="stack">
        {error && <div className="banner banner-danger">{error}</div>}
        {data && (
          <>
            <TankGauge current={data.tank.current} percent={data.tank.percent} critical={data.tank.critical} />
            {isAdmin && (
              <form className="card stack" onSubmit={refillTank}>
                <strong>Reabastecer tanque central</strong>
                <p className="muted">Capacidade {liters(data.tank.capacity)}. Cabe {liters(Math.max(0, data.tank.capacity - data.tank.current))}.</p>
                <div className="field">
                  <label>Litros recebidos</label>
                  <input type="number" min="1" value={refill} onChange={(e) => setRefill(e.target.value)} required />
                </div>
                <button className="btn btn-soft" disabled={saving || !Number(refill)}>
                  {saving ? 'Salvando...' : 'Adicionar ao tanque'}
                </button>
              </form>
            )}
            <div className="kpi">
              <div className="kpi-card">
                <div className="num">{data.fleet.ready}</div>
                <span>Caminhões prontos</span>
              </div>
              <div className="kpi-card">
                <div className="num">{data.fleet.pending}</div>
                <span>Pendente atenção</span>
              </div>
              <div className="kpi-card">
                <div className="num">{data.today.fuelings}</div>
                <span>Abastecimentos hoje</span>
              </div>
              <div className="kpi-card">
                <div className="num">{liters(data.today.liters)}</div>
                <span>Litros distribuídos</span>
              </div>
            </div>
            <Link to="/app/abastecer" className="btn btn-fuel">+ Abastecer caminhão</Link>
            {data.docs_soon?.length > 0 && (
              <Link className="card" to="/app/alertas" style={{ textDecoration: 'none', color: 'inherit' }}>
                <strong>Documentação próxima do vencimento</strong>
                <p className="muted" style={{ marginTop: 6 }}>{data.docs_soon.length} caminhão(ões) com CRLV, seguro ou licenciamento em até 10 dias ou sem data.</p>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}
