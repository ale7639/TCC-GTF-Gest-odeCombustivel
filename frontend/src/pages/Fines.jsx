import { useEffect, useState } from 'react'
import api from '../api/client'
import { apiMessage, dateBr, money } from '../utils/format'

const vazio = {
  caminhao_id: '', motorista_id: '', data: new Date().toISOString().slice(0, 10),
  valor: '', descricao: '', prazo: '', status: 'pendente',
}

export default function Fines() {
  const [lista, setLista] = useState([])
  const [caminhoes, setCaminhoes] = useState([])
  const [motoristas, setMotoristas] = useState([])
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')

  async function carregar() {
    const [m, c, d] = await Promise.all([
      api.get('/multas'),
      api.get('/caminhoes'),
      api.get('/motoristas'),
    ])
    setLista(m.data)
    setCaminhoes(c.data)
    setMotoristas(d.data)
  }

  useEffect(() => { carregar().catch(() => setError('Falha ao carregar multas.')) }, [])

  async function salvar(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...form,
        motorista_id: form.motorista_id || null,
        prazo: form.prazo || null,
      }
      if (form.id) await api.put(`/multas/${form.id}`, payload)
      else await api.post('/multas', payload)
      setForm(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <div className="row space">
        <div>
          <p className="eyebrow">Fiscal</p>
          <h1>Multas</h1>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setForm({ ...vazio })}>Nova</button>
      </div>
      <p className="muted">Cadastro manual com indicação de condutor e prazo — sem DETRAN.</p>
      {error && <div className="banner banner-danger">{error}</div>}
      {lista.map((m) => (
        <div key={m.id} className="card">
          <div className="row space">
            <strong>{m.caminhao?.placa}</strong>
            <span className={`badge ${m.status === 'pago' ? 'badge-ok' : m.atrasada ? 'badge-nao_apto' : 'badge-pendente'}`}>
              {m.status}{m.atrasada ? ' · atrasada' : ''}
            </span>
          </div>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {m.descricao} · {money(m.valor)} · {dateBr(m.data)}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Condutor: {m.motorista?.nome || 'não indicado'} · prazo {dateBr(m.prazo)}
          </p>
          <button className="btn btn-soft" style={{ width: 'auto', marginTop: 8 }} onClick={() => setForm({
            ...m, caminhao_id: m.caminhao_id || m.caminhao?.id, motorista_id: m.motorista_id || m.motorista?.id || '',
          })}>
            Editar
          </button>
        </div>
      ))}
      {form && (
        <form className="card stack" onSubmit={salvar}>
          <h2>{form.id ? 'Editar multa' : 'Nova multa'}</h2>
          <div className="field">
            <label>Caminhão</label>
            <select value={form.caminhao_id} onChange={(e) => setForm({ ...form, caminhao_id: e.target.value })} required>
              <option value="">Selecione</option>
              {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Condutor</label>
            <select value={form.motorista_id || ''} onChange={(e) => setForm({ ...form, motorista_id: e.target.value })}>
              <option value="">Não indicado</option>
              {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div className="field"><label>Data</label><input type="date" value={form.data?.slice?.(0, 10) || form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></div>
          <div className="field"><label>Valor</label><input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></div>
          <div className="field"><label>Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required /></div>
          <div className="field"><label>Prazo</label><input type="date" value={form.prazo?.slice?.(0, 10) || form.prazo || ''} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pendente">Pendente</option>
              <option value="indicado">Indicado</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <button className="btn btn-primary">Salvar</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
    </div>
  )
}
