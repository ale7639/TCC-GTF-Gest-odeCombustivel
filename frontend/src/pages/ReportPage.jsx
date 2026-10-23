import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { dateBr, km, kmPerLiter, liters, money } from '../utils/format'

const titulos = {
  acesso: 'Log de acesso',
  km: 'Quilometragem',
  abastecimentos: 'Abastecimentos',
  consumo: 'Consumo',
  notas: 'Notas fiscais',
}

export default function ReportPage() {
  const { tipo } = useParams()
  const [data, setData] = useState(null)
  const [origem, setOrigem] = useState('')
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())

  useEffect(() => {
    setData(null)
    const req = {
      acesso: () => api.get('/relatorios/auditoria'),
      km: () => api.get('/relatorios/quilometragem'),
      abastecimentos: () => api.get('/relatorios/abastecimentos', { params: { origem: origem || undefined, mes, ano } }),
      consumo: () => api.get('/relatorios/consumo', { params: { mes, ano } }),
      notas: () => api.get('/relatorios/notas'),
    }[tipo]
    if (!req) return
    req().then(({ data: d }) => setData(d)).catch(() => setData([]))
  }, [tipo, origem, mes, ano])

  return (
    <div className="scroll stack">
      <Link className="link" to="/app/relatorios">← Relatórios</Link>
      <h1>{titulos[tipo] || 'Relatório'}</h1>
      {(tipo === 'consumo' || tipo === 'abastecimentos') && (
        <div className="row">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>)}
          </select>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[ano - 1, ano, ano + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y}>{y}</option>)}
          </select>
          {tipo === 'abastecimentos' && (
            <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Todos</option>
              <option value="base">Base</option>
              <option value="externo">Posto</option>
            </select>
          )}
        </div>
      )}
      {data == null && <p className="muted">Carregando…</p>}
      {tipo === 'acesso' && Array.isArray(data) && <Acesso lista={data} />}
      {tipo === 'km' && Array.isArray(data) && <Km lista={data} />}
      {tipo === 'abastecimentos' && Array.isArray(data) && <Abast lista={data} />}
      {tipo === 'consumo' && data && !Array.isArray(data) && <Consumo data={data} />}
      {tipo === 'notas' && Array.isArray(data) && <Notas lista={data} />}
    </div>
  )
}

function Acesso({ lista }) {
  if (!lista.length) return <EmptyState icon="📋" title="Nada registrado ainda" />
  return lista.map((l) => (
    <div key={l.id} className="card">
      <strong>{l.action}</strong>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        {l.user?.name || '—'} · {dateBr(l.created_at)} · {l.ip_address || 'sem IP'}
      </p>
    </div>
  ))
}

function Km({ lista }) {
  if (!lista.length) return <EmptyState icon="🛣️" title="Sem caminhões" />
  return lista.map((c) => (
    <div key={c.id} className="list-item">
      <div className="grow">
        <div className="plate" style={{ fontSize: 18 }}>{c.placa}</div>
        <p className="muted" style={{ margin: 0 }}>{c.motorista || 'Sem motorista'}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <strong>{km(c.km_atual)}</strong>
        <p className="muted" style={{ margin: 0 }}>{kmPerLiter(c.media_km_l)}</p>
      </div>
    </div>
  ))
}

function Abast({ lista }) {
  if (!lista.length) return <EmptyState icon="⛽" title="Nenhum abastecimento no período" />
  return lista.map((a) => (
    <div key={a.id} className="card">
      <div className="row space">
        <strong>{a.caminhao?.placa}</strong>
        <span className={`badge ${a.origem === 'externo' ? 'badge-pendente' : 'badge-ok'}`}>{a.origem === 'externo' ? 'Posto' : 'Base'}</span>
      </div>
      <p className="muted" style={{ margin: '4px 0 0' }}>
        {dateBr(a.data)} · {liters(a.litros)} · {km(a.km)} · {a.motorista?.nome}
      </p>
      {a.comprovante_url && <img className="preview" style={{ marginTop: 8 }} src={a.comprovante_url} alt="" />}
    </div>
  ))
}

function Consumo({ data }) {
  return (
    <>
      <div className="kpi">
        <div className="kpi-card"><div className="num">{liters(data.total_litros)}</div><span>Total</span></div>
        <div className="kpi-card"><div className="num">{liters(data.media_diaria)}</div><span>Média/dia</span></div>
      </div>
      {data.serie?.length > 0 && (
        <div className="card" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.serie}>
              <XAxis dataKey="data" hide />
              <Tooltip />
              <Bar dataKey="litros" fill="#1c4d3a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <h2>Ranking</h2>
      {(data.ranking || []).map((r) => (
        <div key={r.caminhao_id} className="list-item">
          <div className="grow">
            <strong>{r.placa}</strong>
            <p className="muted" style={{ margin: 0 }}>{r.quantidade} abastecimentos</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>{liters(r.litros)}</strong>
            <p className="muted" style={{ margin: 0 }}>{kmPerLiter(r.media_km_l)}</p>
          </div>
        </div>
      ))}
    </>
  )
}

function Notas({ lista }) {
  if (!lista.length) return <EmptyState icon="🧾" title="Nenhuma nota ainda" />
  return lista.map((n) => (
    <div key={n.id} className="card">
      <div className="row space">
        <strong>NF {n.numero}</strong>
        <span>{money(n.valor_total)}</span>
      </div>
      <p className="muted" style={{ margin: '4px 0 0' }}>{n.fornecedor} · {dateBr(n.data_emissao)}</p>
      {n.entradas?.[0]?.tanque && <p className="muted" style={{ margin: 0 }}>{n.entradas[0].tanque.nome}</p>}
      {n.comprovante_url && <img className="preview" style={{ marginTop: 8 }} src={n.comprovante_url} alt="Nota" />}
    </div>
  ))
}
