import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import DateField from '../components/DateField'
import ImageField from '../components/ImageField'
import { apiMessage, dateBr, liters, todayLocal } from '../utils/format'

const formVazio = () => ({
  caminhao_id: '', origem: 'base', tanque_id: '', posto: '', litros: '', km: '',
  data: todayLocal(),
})

export default function Fueling() {
  const [caminhoes, setCaminhoes] = useState([])
  const [tanques, setTanques] = useState([])
  const [historico, setHistorico] = useState([])
  const [form, setForm] = useState(formVazio)
  const [foto, setFoto] = useState(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [ask, setAsk] = useState(false)
  const [limites, setLimites] = useState(null)

  const carregarHistorico = useCallback(() => (
    api.get('/abastecimentos').then(({ data }) => setHistorico((data || []).slice(0, 30)))
  ), [])

  useEffect(() => {
    api.get('/caminhoes').then(({ data }) => {
      const ativos = data.filter((c) => c.status !== 'inativo')
      setCaminhoes(ativos)
      if (ativos.length === 1) {
        setForm((f) => ({ ...f, caminhao_id: ativos[0].id, km: ativos[0].km_atual }))
      }
    })
    api.get('/tanques').then(({ data }) => setTanques(data))
    carregarHistorico().catch(() => {})
  }, [carregarHistorico])

  useEffect(() => {
    const c = caminhoes.find((x) => String(x.id) === String(form.caminhao_id))
    if (c && !form.km) setForm((f) => ({ ...f, km: c.km_atual }))
  }, [form.caminhao_id, caminhoes])

  useEffect(() => {
    if (!form.caminhao_id) {
      setLimites(null)
      return
    }
    api.get('/abastecimentos/limites', {
      params: {
        caminhao_id: form.caminhao_id,
        tanque_id: form.origem === 'base' ? (form.tanque_id || undefined) : undefined,
        data: form.data,
      },
    }).then(({ data }) => setLimites(data)).catch(() => setLimites(null))
  }, [form.origem, form.tanque_id, form.caminhao_id, form.data])

  async function enviar() {
    setAsk(false)
    setError('')
    setOkMsg('')
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v != null) body.append(k, v)
    })
    if (form.origem === 'externo' && foto) body.append('comprovante', foto)
    try {
      const { data } = await api.post('/abastecimentos', body)
      setOkMsg(`Abastecimento de ${liters(data.litros)} registrado.`)
      setFoto(null)
      const placa = caminhoes.find((c) => String(c.id) === String(form.caminhao_id))
      setForm({
        ...formVazio(),
        caminhao_id: form.caminhao_id,
        km: data.caminhao?.km_atual || placa?.km_atual || form.km,
        origem: 'base',
      })
      await carregarHistorico()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  return (
    <div className="scroll stack">
      <p className="eyebrow">Combustível</p>
      <h1>Abastecer</h1>
      {error && <div className="banner banner-danger">{error}</div>}
      {okMsg && <div className="banner banner-ok">{okMsg}</div>}
      <form className="stack" onSubmit={(e) => { e.preventDefault(); setAsk(true) }}>
        <div className="field">
          <label>Caminhão</label>
          <select value={form.caminhao_id} onChange={(e) => setForm({ ...form, caminhao_id: e.target.value })} required>
            <option value="">Selecione</option>
            {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa} · {c.modelo}</option>)}
          </select>
        </div>
        <div className="filters">
          <button type="button" className={`chip ${form.origem === 'base' ? 'on' : ''}`} onClick={() => setForm({ ...form, origem: 'base' })}>Na base</button>
          <button type="button" className={`chip ${form.origem === 'externo' ? 'on' : ''}`} onClick={() => setForm({ ...form, origem: 'externo' })}>Fora da base</button>
        </div>
        {form.origem === 'base' ? (
          <div className="field">
            <label>Tanque da base</label>
            <select value={form.tanque_id} onChange={(e) => setForm({ ...form, tanque_id: e.target.value })} required>
              <option value="">Selecione</option>
              {tanques.map((t) => <option key={t.id} value={t.id}>{t.nome} · {liters(t.nivel_atual)}</option>)}
            </select>
            {limites?.max_litros_base != null && <span className="hint">Máximo neste tanque: {liters(limites.max_litros_base)}</span>}
            {limites?.motorista && (
              <span className="hint">
                Limite dia: {limites.motorista.limite_litros_dia != null ? liters(limites.motorista.limite_litros_dia) : '—'}
                {' · '}crédito mês: {limites.motorista.credito_litros_mes != null ? liters(limites.motorista.credito_litros_mes) : '—'}
                {' · '}usado hoje {liters(limites.motorista.usado_dia)}
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="field">
              <label>Posto</label>
              <input value={form.posto} onChange={(e) => setForm({ ...form, posto: e.target.value })} placeholder="Nome do posto" required />
            </div>
            <ImageField label="Foto do cupom" file={foto} onChange={setFoto} hint="Obrigatório no abastecimento fora da base." />
          </>
        )}
        <div className="field">
          <label>Litros</label>
          <input type="number" step="0.01" value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} required />
        </div>
        <div className="field">
          <label>KM do caminhão</label>
          <input type="number" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} required />
        </div>
        <DateField
          label="Data"
          value={form.data}
          onChange={(data) => setForm({ ...form, data })}
          required
        />
        <button className="btn btn-fuel">Continuar</button>
      </form>

      <section className="stack">
        <h2>Últimos abastecimentos</h2>
        {historico.length === 0 && <p className="muted">Nenhum abastecimento ainda.</p>}
        <div className="list">
          {historico.map((a) => (
            <div key={a.id} className="list-item">
              <div className="truck-thumb">{(a.caminhao?.placa || '—').slice(0, 3)}</div>
              <div className="grow">
                <strong className="plate" style={{ fontSize: 18 }}>{a.caminhao?.placa || '—'}</strong>
                <p className="muted" style={{ margin: 0 }}>
                  {dateBr(a.data)} · {a.origem === 'externo' ? (a.posto || 'Posto') : (a.tanque?.nome || 'Base')}
                </p>
              </div>
              <strong>{liters(a.litros)}</strong>
            </div>
          ))}
        </div>
      </section>

      <Link className="link" to="/app">← Painel</Link>

      {ask && (
        <Confirm
          title="Confirmar abastecimento?"
          text={form.origem === 'externo'
            ? `${form.litros} L no posto ${form.posto}.`
            : `${form.litros} L a partir do tanque da base.`}
          onCancel={() => setAsk(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
