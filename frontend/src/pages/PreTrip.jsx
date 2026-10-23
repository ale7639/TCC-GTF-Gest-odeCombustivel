import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import ImageField from '../components/ImageField'
import { apiMessage, dateBr } from '../utils/format'

export default function PreTrip() {
  const [caminhoes, setCaminhoes] = useState([])
  const [itensDef, setItensDef] = useState([])
  const [historico, setHistorico] = useState([])
  const [form, setForm] = useState(null)
  const [foto, setFoto] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(null)
  const [ask, setAsk] = useState(false)

  function carregar() {
    return Promise.all([
      api.get('/caminhoes'),
      api.get('/checklists/itens'),
      api.get('/checklists'),
    ]).then(([c, i, h]) => {
      setCaminhoes(c.data.filter((x) => x.status !== 'inativo'))
      setItensDef(i.data)
      setHistorico(h.data)
    })
  }

  useEffect(() => { carregar().catch(() => setError('Não foi possível carregar.')) }, [])

  function abrir() {
    setOk(null)
    setError('')
    setFoto(null)
    setForm({
      caminhao_id: caminhoes[0]?.id || '',
      data: new Date().toISOString().slice(0, 10),
      observacao: '',
      abrir_manutencao: true,
      itens: itensDef.map((it) => ({ chave: it.chave, ok: true, observacao: '' })),
    })
  }

  function setItem(chave, patch) {
    setForm((f) => ({
      ...f,
      itens: f.itens.map((it) => (it.chave === chave ? { ...it, ...patch } : it)),
    }))
  }

  async function enviar() {
    setAsk(false)
    setError('')
    const body = new FormData()
    body.append('caminhao_id', form.caminhao_id)
    body.append('data', form.data)
    body.append('observacao', form.observacao || '')
    body.append('abrir_manutencao', form.abrir_manutencao ? '1' : '0')
    form.itens.forEach((it, idx) => {
      body.append(`itens[${idx}][chave]`, it.chave)
      body.append(`itens[${idx}][ok]`, it.ok ? '1' : '0')
      if (it.observacao) body.append(`itens[${idx}][observacao]`, it.observacao)
    })
    if (foto) body.append('foto', foto)
    try {
      const { data } = await api.post('/checklists', body)
      setOk(data)
      setForm(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  const rotulo = (chave) => itensDef.find((i) => i.chave === chave)?.rotulo || chave

  return (
    <div className="scroll stack">
      <p className="eyebrow">Pátio</p>
      <h1>Checklist pré-viagem</h1>
      <p className="muted">Saída do pátio: conferência rápida. Item reprovado pode abrir manutenção.</p>
      {error && <div className="banner banner-danger">{error}</div>}
      {ok && (
        <div className={`banner ${ok.status === 'apto' ? 'banner-ok' : 'banner-danger'}`}>
          {ok.status === 'apto' ? 'Veículo apto para viagem.' : 'Não apto — pendência de manutenção aberta se houver falha.'}
          {ok.manutencao && <span> OS #{ok.manutencao.id}.</span>}
        </div>
      )}
      {!form && <button className="btn btn-primary" onClick={abrir}>Nova saída</button>}
      {form && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setAsk(true) }}>
          <div className="field">
            <label>Caminhão</label>
            <select value={form.caminhao_id} onChange={(e) => setForm({ ...form, caminhao_id: e.target.value })} required>
              {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa} · {c.modelo}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Data</label>
            <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </div>
          {form.itens.map((it) => (
            <div key={it.chave} className="card" style={{ padding: 12 }}>
              <div className="row space">
                <strong>{rotulo(it.chave)}</strong>
                <div className="filters">
                  <button type="button" className={`chip ${it.ok ? 'on' : ''}`} onClick={() => setItem(it.chave, { ok: true })}>OK</button>
                  <button type="button" className={`chip ${!it.ok ? 'on' : ''}`} onClick={() => setItem(it.chave, { ok: false })}>Falha</button>
                </div>
              </div>
              {!it.ok && (
                <div className="field" style={{ marginTop: 8 }}>
                  <label>Observação</label>
                  <input value={it.observacao} onChange={(e) => setItem(it.chave, { observacao: e.target.value })} placeholder="O que falhou" />
                </div>
              )}
            </div>
          ))}
          <ImageField label="Foto (opcional)" file={foto} onChange={setFoto} hint="Ex.: painel ou item reprovado." />
          <div className="field">
            <label>Observação geral</label>
            <textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <label className="row">
            <input type="checkbox" checked={form.abrir_manutencao} onChange={(e) => setForm({ ...form, abrir_manutencao: e.target.checked })} />
            Abrir manutenção se houver falha
          </label>
          <button className="btn btn-primary">Registrar checklist</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
      <h2>Últimas saídas</h2>
      {historico.length === 0 && <p className="muted">Nenhum checklist ainda.</p>}
      {historico.map((h) => (
        <div key={h.id} className="list-item">
          <div className="grow">
            <strong>{h.caminhao?.placa}</strong>
            <p className="muted" style={{ margin: 0 }}>{dateBr(h.data)} · {h.motorista?.nome || '—'}</p>
          </div>
          <span className={`badge ${h.status === 'apto' ? 'badge-ok' : 'badge-nao_apto'}`}>
            {h.status === 'apto' ? 'Apto' : 'Não apto'}
          </span>
        </div>
      ))}
      <Link className="link" to="/app">← Painel</Link>
      {ask && (
        <Confirm
          title="Confirmar checklist?"
          text={form.itens.some((i) => !i.ok) ? 'Há itens reprovados — status será não apto.' : 'Todos os itens OK — apto para viagem.'}
          onCancel={() => setAsk(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
