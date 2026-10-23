import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import ImageField from '../components/ImageField'
import Confirm from '../components/Confirm'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, liters, money } from '../utils/format'

export default function TankDetails() {
  const { id } = useParams()
  const { isGestao } = useAuth()
  const [tanque, setTanque] = useState(null)
  const [form, setForm] = useState(null)
  const [foto, setFoto] = useState(null)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState(false)

  function carregar() {
    return api.get(`/tanques/${id}`).then(({ data }) => setTanque(data))
  }
  useEffect(() => { carregar().catch((err) => setError(apiMessage(err))) }, [id])

  async function enviar() {
    setAsk(false)
    setError('')
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => body.append(k, v))
    if (foto) body.append('comprovante', foto)
    try {
      await api.post(`/tanques/${id}/entradas`, body)
      setForm(null)
      setFoto(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  if (!tanque) return <div className="scroll"><p className="muted">{error || 'Carregando…'}</p></div>

  return (
    <div className="scroll stack">
      <Link className="link" to="/app/tanques">← Tanques</Link>
      <div className={`tank ${tanque.alerta ? 'critical' : ''}`}>
        <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>{tanque.tipo_combustivel}</p>
        <h1>{tanque.nome}</h1>
        <div className="num">{liters(tanque.nivel_atual)}</div>
        <div className="progress"><span style={{ width: `${Math.min(100, tanque.percentual)}%` }} /></div>
      </div>
      {isGestao && !form && (
        <button className="btn btn-fuel" onClick={() => setForm({
          data: new Date().toISOString().slice(0, 10), litros: '', valor_total: '', numero: '', fornecedor: '',
        })}>
          Entrada com nota fiscal
        </button>
      )}
      {error && <div className="banner banner-danger">{error}</div>}
      {form && (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); setAsk(true) }}>
          <h2>Nota de entrada</h2>
          <p className="muted">Quando o caminhão-tanque da distribuidora abastece este tanque da base.</p>
          <div className="field"><label>Data</label><input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required /></div>
          <div className="field"><label>Litros</label><input type="number" step="0.01" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} required /></div>
          <div className="field"><label>Valor (R$)</label><input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} required /></div>
          <div className="field"><label>Número da NF</label><input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required /></div>
          <div className="field"><label>Fornecedor</label><input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} required /></div>
          <ImageField label="Foto da nota / cupom" file={foto} onChange={setFoto} hint="Obrigatório. Tire a foto do comprovante." />
          <button className="btn btn-primary">Registrar entrada</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
      <h2>Entradas</h2>
      {(tanque.entradas || []).length === 0 && <p className="muted">Nenhuma entrada ainda.</p>}
      {(tanque.entradas || []).map((e) => (
        <div key={e.id} className="card">
          <div className="row space">
            <strong>{dateBr(e.data)}</strong>
            <span>{liters(e.litros)}</span>
          </div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            NF {e.nota_fiscal?.numero} · {e.nota_fiscal?.fornecedor} · {money(e.valor_total)}
          </p>
          {e.nota_fiscal?.comprovante_url && (
            <img className="preview" style={{ marginTop: 10 }} src={e.nota_fiscal.comprovante_url} alt="Nota fiscal" />
          )}
        </div>
      ))}
      {ask && (
        <Confirm
          title="Confirmar entrada no tanque?"
          text={`${form.litros} L de ${form.fornecedor}, NF ${form.numero}.`}
          onCancel={() => setAsk(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
