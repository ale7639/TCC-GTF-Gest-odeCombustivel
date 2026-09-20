import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, liters } from '../utils/format'

export default function Fueling() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [trucks, setTrucks] = useState([])
  const [truckId, setTruckId] = useState(params.get('truck') || '')
  const [quantity, setQuantity] = useState('')
  const [currentLiters, setCurrentLiters] = useState('')
  const [km, setKm] = useState('')
  const [limits, setLimits] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/trucks').then(({ data }) => setTrucks(data.data.filter((item) => item.status === 'ativo')))
  }, [])

  useEffect(() => {
    if (!truckId) {
      setLimits(null)
      setCurrentLiters('')
      return
    }
    api.get('/fuelings/limits', { params: { truck_id: truckId } }).then(({ data }) => {
      setLimits(data)
      setKm(data.truck.current_km)
      setCurrentLiters(String(data.truck.current_liters))
    })
  }, [truckId])

  const qty = Number(quantity)
  const reportedLiters = Number(currentLiters)
  const remaining = limits
    ? Math.max(0, limits.truck.tank_capacity - (Number.isFinite(reportedLiters) ? reportedLiters : 0))
    : 0
  const max = limits ? Math.min(limits.tank_available, remaining) : 0

  const invalid = useMemo(() => {
    if (!limits) return ''
    if (currentLiters === '' || !Number.isFinite(reportedLiters)) return 'Informe o nível atual do tanque do caminhão.'
    if (reportedLiters < 0 || reportedLiters > limits.truck.tank_capacity) {
      return `O nível atual deve estar entre 0 e ${liters(limits.truck.tank_capacity)}.`
    }
    if (!qty) return ''
    if (qty > max) {
      if (remaining < limits.tank_available) {
        return `Máximo permitido: ${liters(max)} (capacidade restante). Ajuste o nível atual se o caminhão voltou da viagem com menos combustível.`
      }
      return `Saldo insuficiente. Disponível no tanque central: ${liters(limits.tank_available)}.`
    }
    return ''
  }, [qty, limits, currentLiters, reportedLiters, remaining, max])

  const projection = limits && qty > 0 && !invalid
    ? Math.min(limits.truck.tank_capacity, reportedLiters + qty)
    : null

  async function submit(event) {
    event.preventDefault()
    if (!truckId) { setError('Selecione um veículo para registrar o abastecimento.'); return }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/fuelings', {
        truck_id: Number(truckId),
        quantity: qty,
        current_liters: reportedLiters,
        current_km: km ? Number(km) : undefined,
      })
      navigate('/app/abastecer/confirmacao', { state: data.data })
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível salvar. Verifique a conexão e tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="scroll">
      <p className="eyebrow">Operação</p>
      <h1>Abastecer caminhão</h1>
      <p className="muted">Se o caminhão voltou da viagem, informe o nível atual do tanque antes de lançar os litros novos.</p>
      <form className="stack" style={{ marginTop: 16 }} onSubmit={submit}>
        {(error || invalid) && <div className="banner banner-danger">{error || invalid}</div>}
        <div className="field">
          <label>Caminhão</label>
          <select value={truckId} onChange={(e) => setTruckId(e.target.value)} required>
            <option value="">Selecione</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>{truck.plate} · {truck.model}</option>
            ))}
          </select>
        </div>
        {limits && (
          <div className="card muted">
            Último registro no sistema: {liters(limits.truck.current_liters)} de {liters(limits.truck.tank_capacity)}
            <br />
            Tanque central: {liters(limits.tank_available)} · Cabe agora: {liters(max)}
          </div>
        )}
        <div className="field">
          <label>Nível atual no caminhão (litros)</label>
          <input
            type="number"
            min="0"
            max={limits?.truck.tank_capacity}
            step="1"
            value={currentLiters}
            onChange={(e) => setCurrentLiters(e.target.value)}
            required
          />
          <span className="hint">Ex.: encheu de manhã, voltou da viagem com 200 L — coloque 200 e depois os litros deste abastecimento.</span>
        </div>
        <div className={`field ${invalid && qty ? 'error' : ''}`}>
          <label>Quantidade a abastecer (litros)</label>
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          {invalid && qty ? <span className="error-text">{invalid}</span> : null}
        </div>
        <div className="field">
          <label>KM atual (opcional)</label>
          <input type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        {projection !== null && (
          <div className="banner banner-ok">Projeção no caminhão: {liters(projection)}</div>
        )}
        {max >= 1 && (
          <button type="button" className="btn btn-soft" onClick={() => setQuantity(String(Math.floor(max)))}>
            Completar tanque ({liters(max)})
          </button>
        )}
        <button className="btn btn-fuel" disabled={loading || Boolean(invalid) || !qty}>
          {loading ? 'Registrando...' : 'Confirmar abastecimento'}
        </button>
      </form>
    </div>
  )
}
