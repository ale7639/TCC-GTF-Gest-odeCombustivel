import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import { apiMessage, dateBr, km } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function Maintenance() {
  const { id } = useParams()
  const { canManage } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [form, setForm] = useState({
    service_date: new Date().toISOString().slice(0, 10),
    km: '',
    description: '',
    next_date: '',
    next_km: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/trucks/${id}/maintenances`).then(({ data }) => {
      setData(data)
      setForm((current) => ({ ...current, km: data.truck.current_km }))
    })
  }, [id])

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await api.post(`/trucks/${id}/maintenances`, form)
      const { data } = await api.get(`/trucks/${id}/maintenances`)
      setData(data)
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  if (!data) return <div className="scroll"><p className="muted">Carregando manutenção...</p></div>

  return (
    <div className="scroll">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      <h1>Manutenção preventiva</h1>
      <p className="muted">{data.truck.plate} · {data.truck.model}</p>
      <div className="card" style={{ marginTop: 12 }}>
        <p><strong>Próxima revisão</strong><br />{dateBr(data.truck.next_maintenance_date)}</p>
        {data.truck.km_left !== null && <p className="muted">Faltam {km(data.truck.km_left)}</p>}
      </div>
      {canManage && (
        <form className="stack" style={{ marginTop: 16 }} onSubmit={submit}>
          {error && <div className="banner banner-danger">{error}</div>}
          <div className="field">
            <label>Data do serviço</label>
            <input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} required />
          </div>
          <div className="field">
            <label>Quilometragem</label>
            <input type="number" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} required />
          </div>
          <div className="field">
            <label>Descrição</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          </div>
          <div className="field">
            <label>Próxima data</label>
            <input type="date" value={form.next_date} onChange={(e) => setForm({ ...form, next_date: e.target.value })} />
          </div>
          <div className="field">
            <label>Próximo KM</label>
            <input type="number" value={form.next_km} onChange={(e) => setForm({ ...form, next_km: e.target.value })} />
          </div>
          <span className="hint">Preencha a próxima data e o próximo KM para o checklist sair de pendente.</span>
          <button className="btn btn-primary">Registrar manutenção</button>
        </form>
      )}
      <h2 style={{ marginTop: 24 }}>Histórico</h2>
      <div className="list" style={{ marginTop: 10 }}>
        {data.data.length === 0 && <p className="muted">Nenhuma manutenção registrada ainda.</p>}
        {data.data.map((item) => (
          <div className="list-item" key={item.id}>
            <div className="grow">
              <strong>{item.description}</strong>
              <div className="muted">{dateBr(item.service_date)} · {km(item.km)} · {item.user?.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
