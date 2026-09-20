import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { kmPerLiter, liters } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function Reports() {
  const { canReport } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [trucks, setTrucks] = useState([])
  const [truckId, setTruckId] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canReport) return
    api.get('/trucks').then(({ data }) => setTrucks(data.data)).catch(() => {})
  }, [canReport])

  useEffect(() => {
    if (!canReport) return
    const params = { month, year }
    if (truckId) params.truck_id = truckId
    api.get('/reports/consumption', { params })
      .then(({ data }) => { setReport(data); setError('') })
      .catch(() => setError('Não foi possível gerar o relatório.'))
  }, [month, year, truckId, canReport])

  if (!canReport) return <Navigate to="/app" replace />
  if (!report) return <div className="scroll"><p className="muted">Gerando relatório...</p></div>

  async function exportCsv() {
    const params = { month, year }
    if (truckId) params.truck_id = truckId
    const response = await api.get('/reports/consumption.csv', { params, responseType: 'blob' })
    const url = window.URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `gfc-consumo-${year}-${String(month).padStart(2, '0')}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  function exportPdf() {
    window.print()
  }

  return (
    <div className="scroll">
      <p className="eyebrow">Gestão</p>
      <h1>Relatórios</h1>
      <div className="stack" style={{ marginTop: 16 }}>
        {error && <div className="banner banner-danger">{error}</div>}
        <div className="row">
          <div className="field grow">
            <label>Mês</label>
            <input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          </div>
          <div className="field grow">
            <label>Ano</label>
            <input type="number" min="2020" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Caminhão</label>
          <select value={truckId} onChange={(e) => setTruckId(e.target.value)}>
            <option value="">Todos</option>
            {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.plate}</option>)}
          </select>
        </div>
        {report.empty ? (
          <EmptyState
            icon="📊"
            title="Sem dados neste período"
            text={`Nenhum abastecimento em ${String(month).padStart(2, '0')}/${year}.`}
          >
            <button className="btn btn-primary" onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()) }}>Mudar período</button>
            <a className="btn btn-soft" href="/app/abastecer">Registrar abastecimento</a>
          </EmptyState>
        ) : (
          <>
            <div className="kpi">
              <div className="kpi-card"><div className="num">{liters(report.total_liters)}</div><span>Total do período</span></div>
              <div className="kpi-card"><div className="num">{liters(report.daily_average)}</div><span>Média diária</span></div>
              <div className="kpi-card"><div className="num">{kmPerLiter(report.km_per_liter)}</div><span>Média km/L</span></div>
            </div>
            <div className="card" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.by_day}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="liters" fill="#1c4d3a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <h2>Ranking</h2>
            <div className="list">
              {report.ranking.map((item, index) => (
                <div className="list-item" key={item.truck_id}>
                  <div className="truck-thumb">{index + 1}</div>
                  <div className="grow">
                    <strong>{item.plate}</strong>
                    <div className="muted">{item.model}{item.km_per_liter ? ` · ${kmPerLiter(item.km_per_liter)}` : ''}</div>
                  </div>
                  <span className="num">{liters(item.liters)}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-soft" onClick={exportCsv}>Exportar CSV</button>
            <button className="btn btn-ghost" onClick={exportPdf}>Exportar PDF</button>
          </>
        )}
      </div>
    </div>
  )
}
