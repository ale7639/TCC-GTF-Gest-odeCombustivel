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
  const [conc, setConc] = useState(null)
  const [concForm, setConcForm] = useState(null)
  const [conciliacoes, setConciliacoes] = useState([])

  function carregar() {
    return api.get(`/tanques/${id}`).then(({ data }) => setTanque(data))
  }
  function carregarConc() {
    if (!isGestao) return Promise.resolve()
    return api.get(`/tanques/${id}/conciliacoes`).then(({ data }) => setConciliacoes(data))
  }
  useEffect(() => {
    carregar().catch((err) => setError(apiMessage(err)))
    carregarConc().catch(() => {})
  }, [id, isGestao])

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
      {isGestao && !form && !concForm && (
        <>
          <button className="btn btn-fuel" onClick={() => setForm({
            data: new Date().toISOString().slice(0, 10), litros: '', valor_total: '', numero: '', fornecedor: '',
          })}>
            Entrada com nota fiscal
          </button>
          <button className="btn btn-soft" onClick={async () => {
            const data = new Date().toISOString().slice(0, 10)
            const { data: prev } = await api.get(`/tanques/${id}/conciliacoes/preview`, { params: { data } })
            setConc(prev)
            setConcForm({ data, nivel_informado: String(tanque.nivel_atual), observacao: '' })
          }}>
            Conciliação diária
          </button>
        </>
      )}
      {error && <div className="banner banner-danger">{error}</div>}
      {concForm && (
        <form className="card stack" onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          try {
            await api.post(`/tanques/${id}/conciliacoes`, concForm)
            setConcForm(null)
            setConc(null)
            await carregar()
            await carregarConc()
          } catch (err) {
            setError(apiMessage(err))
          }
        }}>
          <h2>Conciliação do tanque</h2>
          <p className="muted">Entradas − saídas do dia vs. nível medido. Variação &gt; 50 L gera alerta.</p>
          {conc && (
            <p className="muted">
              Entradas {liters(conc.entradas_dia)} · Saídas {liters(conc.saidas_dia)} · Nível sistema {liters(conc.nivel_sistema)}
            </p>
          )}
          <div className="field"><label>Data</label><input type="date" value={concForm.data} onChange={async (e) => {
            const data = e.target.value
            setConcForm({ ...concForm, data })
            const { data: prev } = await api.get(`/tanques/${id}/conciliacoes/preview`, { params: { data } })
            setConc(prev)
          }} required /></div>
          <div className="field"><label>Nível medido (L)</label><input type="number" step="0.01" value={concForm.nivel_informado} onChange={(e) => setConcForm({ ...concForm, nivel_informado: e.target.value })} required /></div>
          <div className="field"><label>Observação</label><input value={concForm.observacao} onChange={(e) => setConcForm({ ...concForm, observacao: e.target.value })} /></div>
          <button className="btn btn-primary">Salvar conciliação</button>
          <button type="button" className="btn btn-soft" onClick={() => { setConcForm(null); setConc(null) }}>Cancelar</button>
        </form>
      )}
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
      {isGestao && conciliacoes.length > 0 && (
        <>
          <h2>Conciliações</h2>
          {conciliacoes.map((c) => (
            <div key={c.id} className="list-item">
              <div className="grow">
                <strong>{dateBr(c.data)}</strong>
                <p className="muted" style={{ margin: 0 }}>
                  Medido {liters(c.nivel_informado)} · sistema {liters(c.nivel_calculado)} · Δ {liters(c.variacao)}
                </p>
              </div>
              {c.alerta && <span className="badge badge-nao_apto">Alerta</span>}
            </div>
          ))}
        </>
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
