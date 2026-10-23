import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import ImageField from '../components/ImageField'
import { apiMessage, liters } from '../utils/format'

export default function Fueling() {
  const [caminhoes, setCaminhoes] = useState([])
  const [tanques, setTanques] = useState([])
  const [form, setForm] = useState({
    caminhao_id: '', origem: 'base', tanque_id: '', posto: '', litros: '', km: '',
    data: new Date().toISOString().slice(0, 10), motivo_excesso: '',
  })
  const [foto, setFoto] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(null)
  const [ask, setAsk] = useState(false)
  const [limites, setLimites] = useState(null)

  useEffect(() => {
    api.get('/caminhoes').then(({ data }) => {
      setCaminhoes(data.filter((c) => c.status !== 'inativo'))
      if (data.length === 1) setForm((f) => ({ ...f, caminhao_id: data[0].id, km: data[0].km_atual }))
    })
    api.get('/tanques').then(({ data }) => setTanques(data))
  }, [])

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

  const precisaMotivo = useMemo(() => {
    if (form.origem !== 'base' || !limites?.motorista || !form.litros) return false
    const litros = Number(form.litros)
    const m = limites.motorista
    if (m.limite_litros_dia != null && (m.usado_dia + litros) > m.limite_litros_dia) return true
    if (m.credito_litros_mes != null && (m.usado_mes + litros) > m.credito_litros_mes) return true
    return false
  }, [form.origem, form.litros, limites])

  async function enviar() {
    setAsk(false)
    setError('')
    const body = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v != null) body.append(k, v)
    })
    if (form.origem === 'externo' && foto) body.append('comprovante', foto)
    try {
      const { data } = await api.post('/abastecimentos', body)
      setOk(data)
      setFoto(null)
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  if (ok) {
    return (
      <div className="scroll stack">
        <div className="banner banner-ok">Abastecimento registrado.</div>
        <div className="card">
          <p className="eyebrow">{ok.origem === 'externo' ? 'Posto' : ok.tanque?.nome}</p>
          <div className="num">{liters(ok.litros)}</div>
          <p className="muted">{ok.caminhao?.placa} · KM {ok.km}</p>
          {ok.motivo_excesso && <p className="muted">Motivo: {ok.motivo_excesso}</p>}
          {ok.comprovante_url && <img className="preview" src={ok.comprovante_url} alt="Comprovante" />}
        </div>
        <button className="btn btn-primary" onClick={() => setOk(null)}>Novo registro</button>
        <Link className="btn btn-soft" to="/app">Voltar ao painel</Link>
      </div>
    )
  }

  return (
    <div className="scroll stack">
      <p className="eyebrow">Combustível</p>
      <h1>Abastecer</h1>
      {error && <div className="banner banner-danger">{error}</div>}
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
        {precisaMotivo && (
          <div className="field">
            <label>Motivo do excesso (obrigatório)</label>
            <select value={form.motivo_excesso} onChange={(e) => setForm({ ...form, motivo_excesso: e.target.value })} required>
              <option value="">Selecione</option>
              <option value="ocioso">Veículo ocioso / fila</option>
              <option value="desvio">Desvio de rota</option>
              <option value="clima">Clima / estrada ruim</option>
              <option value="carga">Carga pesada</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        )}
        <div className="field">
          <label>KM do caminhão</label>
          <input type="number" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} required />
        </div>
        <div className="field">
          <label>Data</label>
          <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
        </div>
        <button className="btn btn-fuel">Continuar</button>
      </form>
      {ask && (
        <Confirm
          title="Confirmar abastecimento?"
          text={form.origem === 'externo'
            ? `${form.litros} L no posto ${form.posto}.`
            : `${form.litros} L a partir do tanque da base.${precisaMotivo ? ` Motivo: ${form.motivo_excesso}.` : ''}`}
          onCancel={() => setAsk(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
