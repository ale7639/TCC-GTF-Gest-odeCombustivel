import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, km, money, oleoBadge, oleoLabel } from '../utils/format'

const TIPOS = [
  'Troca de óleo',
  'Troca de filtros',
  'Troca de pneus',
  'Revisão de freios',
  'Revisão preventiva',
  'Elétrica / bateria',
  'Outro',
]

const CHECK_BASE = [
  'Óleo e filtros',
  'Freios e pastilhas',
  'Pneus e calibragem',
  'Luzes e sinalização',
  'Fluidos (água, ARLA, hidráulico)',
  'Teste curto no pátio',
]

const emptyForm = () => ({
  status: 'agendada',
  data_prevista: new Date().toISOString().slice(0, 10),
  data_realizada: new Date().toISOString().slice(0, 10),
  tipo: 'Troca de óleo',
  descricao: '',
  valor: '',
  km: '',
  checklist: [...CHECK_BASE],
  marcar_caminhao_manutencao: true,
  oleo_intervalo_km: '10000',
  oleo_proxima_data: '',
})

export default function Maintenance() {
  const { id } = useParams()
  const { isGestao } = useAuth()
  const [caminhao, setCaminhao] = useState(null)
  const [historico, setHistorico] = useState([])
  const [form, setForm] = useState(null)
  const [step, setStep] = useState('form') // form | confirm
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [concluir, setConcluir] = useState(null)

  function carregar() {
    return api.get(`/caminhoes/${id}/manutencoes`).then(({ data }) => {
      setCaminhao(data.caminhao)
      setHistorico(data.historico || [])
      if (!form) {
        setForm(null)
      }
    })
  }

  useEffect(() => {
    carregar().catch((err) => setError(apiMessage(err)))
  }, [id])

  const oleo = caminhao?.oleo
  const isOleo = useMemo(() => /óleo|oleo|lubrificant/i.test(form?.tipo || ''), [form?.tipo])

  function abrirNova() {
    setError('')
    setOk('')
    setStep('form')
    setForm({
      ...emptyForm(),
      km: String(caminhao?.km_atual || ''),
      oleo_intervalo_km: String(caminhao?.oleo_intervalo_km || 10000),
    })
  }

  function toggleCheck(item) {
    setForm((f) => {
      const has = f.checklist.includes(item)
      return {
        ...f,
        checklist: has ? f.checklist.filter((x) => x !== item) : [...f.checklist, item],
      }
    })
  }

  function validarForm() {
    if (!form.data_prevista) return 'Informe a data prevista.'
    if (!form.descricao?.trim()) return 'Descreva o motivo / o que será feito.'
    if (!form.km) return 'Informe o KM.'
    if (form.status === 'concluida' && !form.data_realizada) return 'Informe a data em que foi feita.'
    return ''
  }

  function pedirConfirmacao(event) {
    event.preventDefault()
    const msg = validarForm()
    if (msg) {
      setError(msg)
      return
    }
    setError('')
    setStep('confirm')
  }

  async function salvar() {
    setError('')
    try {
      const payload = {
        status: form.status,
        data_prevista: form.data_prevista,
        data_realizada: form.status === 'concluida' ? form.data_realizada : null,
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        valor: form.valor === '' ? 0 : form.valor,
        km: Number(form.km),
        checklist: form.checklist,
        marcar_caminhao_manutencao: !!form.marcar_caminhao_manutencao,
      }
      if (isOleo && form.status === 'concluida') {
        payload.oleo_intervalo_km = Number(form.oleo_intervalo_km || 10000)
        if (form.oleo_proxima_data) payload.oleo_proxima_data = form.oleo_proxima_data
      }
      await api.post(`/caminhoes/${id}/manutencoes`, payload)
      setForm(null)
      setStep('form')
      setOk(form.status === 'agendada' ? 'Manutenção agendada.' : 'Manutenção registrada.')
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
      setStep('form')
    }
  }

  async function confirmarConclusao() {
    if (!concluir) return
    setError('')
    try {
      await api.post(`/caminhoes/${id}/manutencoes/${concluir.id}/concluir`, {
        data_realizada: concluir.data_realizada,
        km: Number(concluir.km),
        valor: concluir.valor === '' ? undefined : Number(concluir.valor),
        descricao: concluir.descricao || undefined,
        liberar_caminhao: true,
        oleo_intervalo_km: /óleo|oleo/i.test(concluir.tipo)
          ? Number(concluir.oleo_intervalo_km || 10000)
          : undefined,
      })
      setConcluir(null)
      setOk('Manutenção concluída.')
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  if (error && !caminhao) {
    return <div className="scroll"><div className="banner banner-danger">{error}</div></div>
  }
  if (!caminhao) return <div className="scroll"><p className="muted">Carregando…</p></div>

  return (
    <div className="scroll stack">
      <Link className="link" to="/app/manutencao">← Hub de manutenção</Link>
      <div className="row space">
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{caminhao.modelo}</p>
          <h1 className="plate" style={{ fontSize: 28 }}>{caminhao.placa}</h1>
        </div>
        {isGestao && !form && (
          <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={abrirNova}>
            Nova
          </button>
        )}
      </div>

      <div className={`card oleo-card alerta-${oleo?.alerta || 'ok'}`}>
        <div className="row space">
          <div>
            <p className="eyebrow">Troca de óleo</p>
            <strong>{oleo?.rotulo || '—'}</strong>
          </div>
          <span className={`badge ${oleoBadge(oleo?.alerta)}`}>{oleoLabel(oleo?.alerta)}</span>
        </div>
        <div className="mini" style={{ marginTop: 12 }}>
          <div><span>Última data</span><strong>{dateBr(oleo?.ultima_data)}</strong></div>
          <div><span>Última KM</span><strong>{oleo?.ultima_km != null ? km(oleo.ultima_km) : '—'}</strong></div>
          <div><span>Próxima KM</span><strong>{oleo?.proxima_km != null ? km(oleo.proxima_km) : '—'}</strong></div>
          <div><span>Próxima data</span><strong>{dateBr(oleo?.proxima_data)}</strong></div>
        </div>
        {oleo?.restante_km != null && (
          <p className="muted" style={{ margin: '10px 0 0' }}>
            {oleo.restante_km <= 0
              ? `Passou ${km(Math.abs(oleo.restante_km))} do intervalo.`
              : `Faltam cerca de ${km(oleo.restante_km)} para a próxima troca.`}
          </p>
        )}
      </div>

      {ok && <div className="banner banner-ok">{ok}</div>}
      {error && <div className="banner banner-danger">{error}</div>}

      {form && step === 'form' && (
        <form className="card stack" onSubmit={pedirConfirmacao}>
          <h2>Registrar manutenção</h2>
          <div className="field">
            <label>Situação</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="agendada">Agendada (ainda vai ser feita)</option>
              <option value="concluida">Já concluída</option>
            </select>
          </div>
          <div className="field">
            <label>Data prevista</label>
            <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} required />
          </div>
          {form.status === 'concluida' && (
            <div className="field">
              <label>Data em que foi feita</label>
              <input type="date" value={form.data_realizada} onChange={(e) => setForm({ ...form, data_realizada: e.target.value })} required />
            </div>
          )}
          <div className="field">
            <label>Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Motivo / descrição</label>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex.: ruído na suspensão; troca de óleo S15 15W40; revisão antes da viagem SP."
              required
            />
          </div>
          <div className="field">
            <label>KM no odômetro</label>
            <input type="number" min="0" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} required />
          </div>
          <div className="field">
            <label>Valor (R$)</label>
            <input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0" />
          </div>

          <fieldset className="check-grid">
            <legend>Checklist da oficina</legend>
            {CHECK_BASE.map((item) => (
              <label key={item} className="check-item">
                <input
                  type="checkbox"
                  checked={form.checklist.includes(item)}
                  onChange={() => toggleCheck(item)}
                />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>

          {form.status === 'agendada' && (
            <label className="check-item">
              <input
                type="checkbox"
                checked={form.marcar_caminhao_manutencao}
                onChange={(e) => setForm({ ...form, marcar_caminhao_manutencao: e.target.checked })}
              />
              <span>Marcar caminhão como “em manutenção”</span>
            </label>
          )}

          {isOleo && form.status === 'concluida' && (
            <div className="stack" style={{ gap: 10 }}>
              <p className="eyebrow">Campos de óleo</p>
              <div className="field">
                <label>Intervalo até a próxima (km)</label>
                <input type="number" min="1000" value={form.oleo_intervalo_km} onChange={(e) => setForm({ ...form, oleo_intervalo_km: e.target.value })} />
              </div>
              <div className="field">
                <label>Próxima data sugerida (opcional)</label>
                <input type="date" value={form.oleo_proxima_data} onChange={(e) => setForm({ ...form, oleo_proxima_data: e.target.value })} />
              </div>
            </div>
          )}

          <button className="btn btn-primary" type="submit">Revisar e confirmar</button>
          <button type="button" className="btn btn-soft" onClick={() => { setForm(null); setStep('form') }}>Cancelar</button>
        </form>
      )}

      {form && step === 'confirm' && (
        <Confirm
          title="Confirmar manutenção?"
          text={`${form.status === 'agendada' ? 'Agendar' : 'Registrar'} ${form.tipo} em ${caminhao.placa} — prevista ${dateBr(form.data_prevista)}${form.status === 'concluida' ? `, feita em ${dateBr(form.data_realizada)}` : ''}. Motivo: ${form.descricao}`}
          confirmLabel="Salvar"
          onCancel={() => setStep('form')}
          onConfirm={salvar}
        />
      )}

      <h2>Histórico</h2>
      {historico.length === 0 && <p className="muted">Nenhuma manutenção neste caminhão ainda.</p>}
      <div className="list">
        {historico.map((m) => (
          <div key={m.id} className="card stack" style={{ gap: 8 }}>
            <div className="row space">
              <strong>{m.tipo}</strong>
              <span className={`badge ${m.status === 'agendada' ? 'badge-pendente' : 'badge-ok'}`}>
                {m.status === 'agendada' ? 'Agendada' : 'Concluída'}
              </span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Prevista {dateBr(m.data_prevista || m.data)}
              {m.data_realizada ? ` · Feita ${dateBr(m.data_realizada)}` : ''}
              {' · '}{km(m.km)}
              {m.valor != null ? ` · ${money(m.valor)}` : ''}
            </p>
            {m.descricao && <p style={{ margin: 0, fontSize: 14 }}>{m.descricao}</p>}
            {Array.isArray(m.checklist) && m.checklist.length > 0 && (
              <ul className="check-list">
                {m.checklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {isGestao && m.status === 'agendada' && (
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => setConcluir({
                  id: m.id,
                  tipo: m.tipo,
                  data_realizada: new Date().toISOString().slice(0, 10),
                  km: String(caminhao.km_atual || m.km || ''),
                  valor: m.valor != null ? String(m.valor) : '',
                  descricao: m.descricao || '',
                  oleo_intervalo_km: String(caminhao.oleo_intervalo_km || 10000),
                })}
              >
                Concluir agora
              </button>
            )}
          </div>
        ))}
      </div>

      {concluir && (
        <div className="overlay" role="dialog" aria-modal>
          <form
            className="modal stack"
            onSubmit={(e) => { e.preventDefault(); confirmarConclusao() }}
          >
            <h2>Concluir manutenção</h2>
            <p className="muted">{concluir.tipo}</p>
            <div className="field">
              <label>Data em que foi feita</label>
              <input type="date" required value={concluir.data_realizada} onChange={(e) => setConcluir({ ...concluir, data_realizada: e.target.value })} />
            </div>
            <div className="field">
              <label>KM</label>
              <input type="number" required value={concluir.km} onChange={(e) => setConcluir({ ...concluir, km: e.target.value })} />
            </div>
            <div className="field">
              <label>Valor (R$)</label>
              <input type="number" step="0.01" value={concluir.valor} onChange={(e) => setConcluir({ ...concluir, valor: e.target.value })} />
            </div>
            <div className="actions">
              <button className="btn btn-primary" type="submit">Confirmar conclusão</button>
              <button type="button" className="btn btn-soft" onClick={() => setConcluir(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
