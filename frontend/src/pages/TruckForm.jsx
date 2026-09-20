import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, fieldError } from '../utils/format'
import { isValidPlate, normalizePlate } from '../utils/plate'
import { useAuth } from '../context/AuthContext'

const empty = {
  plate: '', name: '', model: '', fuel_type: 'Diesel S10', tank_capacity: 1200,
  current_km: 0, sector: 'Logística', wash_frequency_days: 7, driver_id: '',
  crlv_expires_at: '', insurance_expires_at: '', license_expires_at: '',
}

function dateValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

export default function TruckForm() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [plateMsg, setPlateMsg] = useState('')
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    api.get('/users').then(({ data }) => {
      setDrivers((data.data || []).filter((user) => user.role === 'motorista' && user.is_active !== false))
    }).catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    if (!id) return
    api.get(`/trucks/${id}`).then(({ data }) => {
      const truck = data.data
      setForm({
        ...empty,
        ...truck,
        driver_id: truck.driver?.id || '',
        crlv_expires_at: dateValue(truck.crlv_expires_at),
        insurance_expires_at: dateValue(truck.insurance_expires_at),
        license_expires_at: dateValue(truck.license_expires_at),
      })
    }).catch((err) => setError(apiMessage(err, 'Não foi possível carregar o caminhão.')))
  }, [id])

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function checkPlate() {
    const plate = normalizePlate(form.plate)
    set('plate', plate)
    if (!isValidPlate(plate)) {
      setPlateMsg('Placa deve seguir o formato AAA-9999 ou AAA9A99.')
      return
    }
    try {
      const { data } = await api.get('/trucks/check-plate', { params: { plate, ignore_id: id || undefined } })
      setPlateMsg(data.message)
      setError(data.available ? '' : data.message)
    } catch (err) {
      setPlateMsg(err.response?.data?.message || 'Placa deve seguir o formato AAA-9999 ou AAA9A99.')
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!isValidPlate(form.plate)) {
      setError('Placa deve seguir o formato AAA-9999 ou AAA9A99.')
      return
    }
    setLoading(true)
    try {
      const payload = {
        plate: normalizePlate(form.plate),
        name: form.name,
        model: form.model,
        fuel_type: form.fuel_type,
        tank_capacity: form.tank_capacity,
        current_km: form.current_km,
        sector: form.sector,
        wash_frequency_days: form.wash_frequency_days,
        driver_id: form.driver_id || null,
        crlv_expires_at: form.crlv_expires_at || null,
        insurance_expires_at: form.insurance_expires_at || null,
        license_expires_at: form.license_expires_at || null,
      }
      if (id) await api.put(`/trucks/${id}`, payload)
      else await api.post('/trucks', payload)
      navigate('/app/frota')
    } catch (err) {
      setError(fieldError(err, 'plate') || apiMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) return <Navigate to="/app/frota" replace />

  return (
    <div className="scroll">
      <div className="topbar">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      </div>
      <h1>{id ? 'Editar caminhão' : 'Cadastrar caminhão'}</h1>
      <p className="muted">Placa antiga ou Mercosul. Informe as datas da documentação para o checklist sair de pendente.</p>
      <form className="stack" style={{ marginTop: 16 }} onSubmit={submit}>
        {error && <div className="banner banner-danger">{error}</div>}
        <div className={`field ${error ? 'error' : ''}`}>
          <label>Placa</label>
          <input value={form.plate} onChange={(e) => set('plate', normalizePlate(e.target.value))} placeholder="ABC-1234" required />
          <button type="button" className="btn btn-ghost" onClick={checkPlate}>Verificar placa</button>
          {plateMsg && <span className="hint">{plateMsg}</span>}
        </div>
        <div className="field">
          <label>Nome / identificação</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="field">
          <label>Modelo</label>
          <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Volvo FH 540" required />
        </div>
        <div className="field">
          <label>Tipo de combustível</label>
          <select value={form.fuel_type} onChange={(e) => set('fuel_type', e.target.value)}>
            <option>Diesel S10</option>
            <option>Diesel S500</option>
            <option>Arla 32</option>
          </select>
        </div>
        <div className="field">
          <label>Capacidade do tanque (L)</label>
          <input type="number" min="50" value={form.tank_capacity} onChange={(e) => set('tank_capacity', e.target.value)} required />
        </div>
        <div className="field">
          <label>KM atual</label>
          <input type="number" min="0" value={form.current_km} onChange={(e) => set('current_km', e.target.value)} required />
        </div>
        <div className="field">
          <label>Setor / operação</label>
          <input value={form.sector} onChange={(e) => set('sector', e.target.value)} required />
        </div>
        <div className="field">
          <label>Frequência de lavagem (dias)</label>
          <input type="number" min="1" max="30" value={form.wash_frequency_days} onChange={(e) => set('wash_frequency_days', e.target.value)} required />
        </div>
        <div className="field">
          <label>Motorista responsável</label>
          <select value={form.driver_id} onChange={(e) => set('driver_id', e.target.value)}>
            <option value="">Sem motorista</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name}</option>
            ))}
          </select>
          <span className="hint">Cadastre o motorista em Mais → Usuários, com o perfil Motorista.</span>
        </div>
        <div className="field">
          <label>Vencimento do CRLV</label>
          <input type="date" value={form.crlv_expires_at} onChange={(e) => set('crlv_expires_at', e.target.value)} />
        </div>
        <div className="field">
          <label>Vencimento do seguro</label>
          <input type="date" value={form.insurance_expires_at} onChange={(e) => set('insurance_expires_at', e.target.value)} />
        </div>
        <div className="field">
          <label>Vencimento do licenciamento</label>
          <input type="date" value={form.license_expires_at} onChange={(e) => set('license_expires_at', e.target.value)} />
        </div>
        <span className="hint">Sem data ou com data vencida, o checklist marca a documentação como pendente.</span>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : id ? 'Salvar alterações' : 'Cadastrar caminhão'}</button>
      </form>
    </div>
  )
}
