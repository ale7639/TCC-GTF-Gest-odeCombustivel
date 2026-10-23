import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, fieldError } from '../utils/format'

const vazio = { placa: '', modelo: '', ano: new Date().getFullYear(), capacidade_tanque: '', km_atual: 0, status: 'ativo', motorista_id: '' }

export default function TruckForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(vazio)
  const [motoristas, setMotoristas] = useState([])
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/motoristas').then(({ data }) => setMotoristas(data)).catch(() => {})
    if (id) {
      api.get(`/caminhoes/${id}`).then(({ data }) => setForm({
        placa: data.placa,
        modelo: data.modelo,
        ano: data.ano,
        capacidade_tanque: data.capacidade_tanque,
        km_atual: data.km_atual,
        status: data.status,
        motorista_id: data.motorista_id || '',
      }))
    }
  }, [id])

  function set(field, value) {
    setForm((c) => ({ ...c, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setErrors({})
    const payload = { ...form, motorista_id: form.motorista_id || null }
    try {
      if (id) await api.put(`/caminhoes/${id}`, payload)
      else await api.post('/caminhoes', payload)
      navigate('/app/frota')
    } catch (err) {
      setError(apiMessage(err))
      setErrors(err.response?.data?.errors || {})
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="scroll stack">
      <Link className="link" to={id ? `/app/frota/${id}` : '/app/frota'}>← Voltar</Link>
      <h1>{id ? 'Editar caminhão' : 'Novo caminhão'}</h1>
      <form className="stack" onSubmit={submit}>
        {error && <div className="banner banner-danger">{error}</div>}
        {['placa', 'modelo'].map((field) => (
          <div className="field" key={field}>
            <label>{field === 'placa' ? 'Placa' : 'Modelo'}</label>
            <input value={form[field]} onChange={(e) => set(field, e.target.value)} required />
            {fieldError({ response: { data: { errors } } }, field) && <span className="error-text">{errors[field][0]}</span>}
          </div>
        ))}
        <div className="field">
          <label>Ano</label>
          <input type="number" value={form.ano} onChange={(e) => set('ano', e.target.value)} required />
        </div>
        <div className="field">
          <label>Capacidade do tanque (L)</label>
          <input type="number" value={form.capacidade_tanque} onChange={(e) => set('capacidade_tanque', e.target.value)} required />
        </div>
        <div className="field">
          <label>KM atual</label>
          <input type="number" value={form.km_atual} onChange={(e) => set('km_atual', e.target.value)} required />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="ativo">Ativo</option>
            <option value="manutencao">Manutenção</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div className="field">
          <label>Motorista</label>
          <select value={form.motorista_id} onChange={(e) => set('motorista_id', e.target.value)}>
            <option value="">Sem motorista</option>
            {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </div>
  )
}
