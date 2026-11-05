import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import DateField from '../components/DateField'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { apiMessage } from '../utils/format'

const vazio = {
  nome: '', cpf: '', cnh: '', cnh_validade: '', telefone: '',
  limite_litros_dia: '', credito_litros_mes: '', ativo: true, caminhao_id: '',
}

export default function Drivers() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [lista, setLista] = useState([])
  const [caminhoes, setCaminhoes] = useState([])
  const [form, setForm] = useState(null)
  const [senhaForm, setSenhaForm] = useState(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [delId, setDelId] = useState(null)

  async function carregar() {
    const [{ data: m }, { data: c }] = await Promise.all([api.get('/motoristas'), api.get('/caminhoes')])
    setLista(m)
    setCaminhoes(c)
  }

  useEffect(() => { carregar().catch(() => setError('Falha ao carregar motoristas.')) }, [])

  // Deep-link do sino: /app/motoristas?senha={id} abre “Alterar senha”.
  useEffect(() => {
    const mid = params.get('senha')
    if (!mid || !lista.length || !isAdmin) return
    const m = lista.find((x) => String(x.id) === String(mid))
    if (!m) return
    setSenhaForm({ id: m.id, nome: m.nome, password: '', password_confirmation: '' })
    setOk(`Pedido de senha: defina uma nova senha para ${m.nome}.`)
    params.delete('senha')
    setParams(params, { replace: true })
  }, [lista, params, setParams, isAdmin])

  async function salvar(event) {
    event.preventDefault()
    setError('')
    setOk('')
    const payload = {
      ...form,
      ativo: Boolean(form.ativo),
      caminhao_id: form.caminhao_id || null,
      cnh_validade: form.cnh_validade || null,
      limite_litros_dia: form.limite_litros_dia !== '' ? form.limite_litros_dia : null,
      credito_litros_mes: form.credito_litros_mes !== '' ? form.credito_litros_mes : null,
    }
    try {
      if (form.id) await api.put(`/motoristas/${form.id}`, payload)
      else await api.post('/motoristas', payload)
      setForm(null)
      setOk(form.id ? 'Motorista atualizado.' : 'Motorista criado. Senha inicial = CPF (só números).')
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  async function salvarSenha(event) {
    event.preventDefault()
    setError('')
    setOk('')
    if (senhaForm.password !== senhaForm.password_confirmation) {
      setError('A confirmação da senha não confere.')
      return
    }
    try {
      await api.put(`/motoristas/${senhaForm.id}/senha`, {
        password: senhaForm.password,
        password_confirmation: senhaForm.password_confirmation,
      })
      setOk(`Senha de ${senhaForm.nome} atualizada.`)
      setSenhaForm(null)
      window.dispatchEvent(new Event('gfc:notificacoes'))
    } catch (err) {
      setError(apiMessage(err))
    }
  }

  async function excluir() {
    try {
      await api.delete(`/motoristas/${delId}`)
      setDelId(null)
      await carregar()
    } catch (err) {
      setError(apiMessage(err))
      setDelId(null)
    }
  }

  return (
    <div className="scroll stack">
      <div className="row space">
        <div>
          <p className="eyebrow">Pessoas</p>
          <h1>Motoristas</h1>
        </div>
        {isAdmin && <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setForm({ ...vazio })}>Novo</button>}
      </div>
      {error && <div className="banner banner-danger">{error}</div>}
      {ok && <div className="banner banner-ok">{ok}</div>}
      {lista.length === 0 && !form && <EmptyState icon="👤" title="Nenhum motorista" />}
      <div className="list">
        {lista.map((m) => (
          <div key={m.id} className="card">
            <div className="row space">
              <div>
                <strong>{m.nome}</strong>
                <p className="muted" style={{ margin: 0 }}>
                  CPF {m.cpf} · {m.caminhao?.placa || 'Sem caminhão'} · {m.telefone || 'sem telefone'}
                  {m.cnh_validade ? ` · CNH até ${String(m.cnh_validade).slice(0, 10).split('-').reverse().join('/')}` : ''}
                </p>
              </div>
              <span className={`badge ${m.ativo ? 'badge-ok' : 'badge-nao_apto'}`}>{m.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {m.whatsapp_url && <a className="btn btn-wa" href={m.whatsapp_url} target="_blank" rel="noreferrer">WhatsApp</a>}
              {isAdmin && <button className="btn btn-soft" style={{ width: 'auto' }} onClick={() => setForm({ ...m, caminhao_id: m.caminhao?.id || '' })}>Editar</button>}
              {isAdmin && (
                <button
                  className="btn btn-soft"
                  style={{ width: 'auto' }}
                  onClick={() => setSenhaForm({ id: m.id, nome: m.nome, password: '', password_confirmation: '' })}
                >
                  Alterar senha
                </button>
              )}
              {isAdmin && <button className="btn btn-ghost" onClick={() => setDelId(m.id)}>Excluir</button>}
            </div>
          </div>
        ))}
      </div>
      {form && (
        <form className="card stack" onSubmit={salvar}>
          <h2>{form.id ? 'Editar' : 'Novo motorista'}</h2>
          {!form.id && (
            <p className="muted" style={{ margin: 0 }}>
              A senha de acesso inicial será o CPF (apenas dígitos).
            </p>
          )}
          <div className="field"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
          <div className="field"><label>CPF</label><input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} required /></div>
          <div className="field"><label>CNH</label><input value={form.cnh} onChange={(e) => setForm({ ...form, cnh: e.target.value })} required /></div>
          <DateField
            label="Validade CNH"
            value={form.cnh_validade?.slice?.(0, 10) || form.cnh_validade || ''}
            onChange={(cnh_validade) => setForm({ ...form, cnh_validade })}
          />
          <div className="field"><label>Telefone</label><input value={form.telefone || ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(44) 99999-0000" /></div>
          <div className="field"><label>Limite litros / dia (base)</label><input type="number" step="0.01" value={form.limite_litros_dia ?? ''} onChange={(e) => setForm({ ...form, limite_litros_dia: e.target.value })} placeholder="ex.: 400" /></div>
          <div className="field"><label>Crédito litros / mês (base)</label><input type="number" step="0.01" value={form.credito_litros_mes ?? ''} onChange={(e) => setForm({ ...form, credito_litros_mes: e.target.value })} placeholder="ex.: 4000" /></div>
          <div className="field">
            <label>Caminhão</label>
            <select value={form.caminhao_id || ''} onChange={(e) => setForm({ ...form, caminhao_id: e.target.value })}>
              <option value="">Sem vínculo</option>
              {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa} · {c.modelo}</option>)}
            </select>
          </div>
          <label className="row"><input type="checkbox" checked={!!form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
          <button className="btn btn-primary">Salvar</button>
          <button type="button" className="btn btn-soft" onClick={() => setForm(null)}>Cancelar</button>
        </form>
      )}
      {senhaForm && (
        <form className="card stack" onSubmit={salvarSenha}>
          <h2>Alterar senha</h2>
          <p className="muted" style={{ margin: 0 }}>
            {senhaForm.nome}. A senha atual não é exibida — defina uma nova e confirme.
          </p>
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password"
              autoComplete="new-password"
              value={senhaForm.password}
              onChange={(e) => setSenhaForm({ ...senhaForm, password: e.target.value })}
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label>Confirmar senha</label>
            <input
              type="password"
              autoComplete="new-password"
              value={senhaForm.password_confirmation}
              onChange={(e) => setSenhaForm({ ...senhaForm, password_confirmation: e.target.value })}
              minLength={8}
              required
            />
          </div>
          <button className="btn btn-primary">Salvar nova senha</button>
          <button type="button" className="btn btn-soft" onClick={() => setSenhaForm(null)}>Cancelar</button>
        </form>
      )}
      {delId && (
        <Confirm danger title="Excluir motorista?" text="Se houver histórico, ele só é inativado." confirmLabel="Excluir"
          onCancel={() => setDelId(null)} onConfirm={excluir} />
      )}
    </div>
  )
}
