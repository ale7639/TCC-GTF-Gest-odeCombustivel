import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { downloadCsv, printReport } from '../utils/export'
import { dateBr, km, kmPerLiter, liters, money } from '../utils/format'

const titulos = {
  acesso: 'Log de acesso',
  km: 'Quilometragem',
  abastecimentos: 'Abastecimentos',
  consumo: 'Consumo',
  notas: 'Notas fiscais',
  cpk: 'Custo por km (CPK)',
  ranking: 'Ranking motoristas',
  disponibilidade: 'Disponibilidade da frota',
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
      cpk: () => api.get('/relatorios/cpk', { params: { mes, ano } }),
      ranking: () => api.get('/relatorios/ranking-motoristas', { params: { mes, ano } }),
      disponibilidade: () => api.get('/relatorios/disponibilidade', { params: { mes, ano } }),
    }[tipo]
    if (!req) return
    req().then(({ data: d }) => setData(d)).catch(() => setData([]))
  }, [tipo, origem, mes, ano])

  function exportar() {
    const rows = toRows(tipo, data)
    if (!rows.length) return
    downloadCsv(`gfc-${tipo}-${mes}-${ano}`, rows)
  }

  const comPeriodo = ['consumo', 'abastecimentos', 'cpk', 'ranking', 'disponibilidade'].includes(tipo)

  return (
    <div className="scroll stack report-print">
      <Link className="link no-print" to="/app/relatorios">← Relatórios</Link>
      <div className="row space">
        <h1>{titulos[tipo] || 'Relatório'}</h1>
      </div>
      <div className="row no-print" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn btn-soft" style={{ width: 'auto' }} onClick={exportar} disabled={data == null}>Exportar CSV</button>
        <button type="button" className="btn btn-soft" style={{ width: 'auto' }} onClick={printReport}>Imprimir / PDF</button>
      </div>
      {comPeriodo && (
        <div className="row no-print">
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
      {tipo === 'cpk' && data && !Array.isArray(data) && <Cpk data={data} />}
      {tipo === 'ranking' && data && !Array.isArray(data) && <Ranking data={data} />}
      {tipo === 'disponibilidade' && data && !Array.isArray(data) && <Disp data={data} />}
    </div>
  )
}

function toRows(tipo, data) {
  if (!data) return []
  if (tipo === 'acesso' && Array.isArray(data)) {
    return data.map((l) => ({ acao: l.action, usuario: l.user?.name, data: l.created_at, ip: l.ip_address }))
  }
  if (tipo === 'km' && Array.isArray(data)) {
    return data.map((c) => ({ placa: c.placa, km: c.km_atual, media_km_l: c.media_km_l, meta_km_l: c.meta_km_l, desvio: c.desvio_meta, motorista: c.motorista }))
  }
  if (tipo === 'abastecimentos' && Array.isArray(data)) {
    return data.map((a) => ({ data: a.data, placa: a.caminhao?.placa, litros: a.litros, km: a.km, origem: a.origem, motorista: a.motorista?.nome }))
  }
  if (tipo === 'consumo' && data.ranking) {
    return data.ranking.map((r) => ({ placa: r.placa, litros: r.litros, media_km_l: r.media_km_l, meta_km_l: r.meta_km_l, desvio_meta: r.desvio_meta, anomalo: r.consumo_anomalo }))
  }
  if (tipo === 'notas' && Array.isArray(data)) {
    return data.map((n) => ({ numero: n.numero, fornecedor: n.fornecedor, data: n.data_emissao, valor: n.valor_total }))
  }
  if (tipo === 'cpk' && data.por_caminhao) {
    return data.por_caminhao.map((c) => ({ placa: c.placa, km: c.km_periodo, custo: c.custo_total, cpk: c.cpk }))
  }
  if (tipo === 'ranking' && data.ranking) {
    return data.ranking.map((r) => ({ motorista: r.nome, litros: r.litros, media_km_l: r.media_km_l, abastecimentos: r.quantidade }))
  }
  if (tipo === 'disponibilidade' && data.caminhoes) {
    return data.caminhoes.map((c) => ({ placa: c.placa, pct: c.disponibilidade_pct, dias_ativo: c.dias_ativo, dias_manut: c.dias_manutencao }))
  }
  return []
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
        <p className="muted" style={{ margin: 0 }}>
          {c.motorista || 'Sem motorista'}
          {c.meta_km_l != null && ` · meta ${kmPerLiter(c.meta_km_l)}`}
          {c.desvio_meta != null && ` · desvio ${c.desvio_meta > 0 ? '+' : ''}${c.desvio_meta}`}
        </p>
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
      {a.motivo_excesso && <p className="muted" style={{ margin: 0 }}>Motivo excesso: {a.motivo_excesso}</p>}
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
      {(data.anomalias || []).length > 0 && (
        <>
          <h2>Consumo anômalo</h2>
          {data.anomalias.map((a) => (
            <div key={a.caminhao_id} className="banner banner-warn">
              {a.placa}: último {kmPerLiter(a.ultimo_km_l)} vs média {kmPerLiter(a.media_km_l)}
            </div>
          ))}
        </>
      )}
      {data.serie?.length > 0 && (
        <div className="card no-print" style={{ height: 180 }}>
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
            <p className="muted" style={{ margin: 0 }}>
              {r.quantidade} abastecimentos
              {r.meta_km_l != null && ` · meta ${kmPerLiter(r.meta_km_l)}`}
              {r.desvio_meta != null && ` · desvio ${r.desvio_meta > 0 ? '+' : ''}${r.desvio_meta}`}
              {r.consumo_anomalo ? ' · anômalo' : ''}
            </p>
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

function Cpk({ data }) {
  return (
    <>
      <div className="kpi">
        <div className="kpi-card"><div className="num">{money(data.custo_total)}</div><span>Custo total</span></div>
        <div className="kpi-card"><div className="num">{data.cpk != null ? `R$ ${Number(data.cpk).toFixed(3)}` : '—'}</div><span>CPK frota</span></div>
        <div className="kpi-card"><div className="num">{km(data.km_total)}</div><span>KM período</span></div>
        <div className="kpi-card"><div className="num">{money(data.preco_medio_litro)}</div><span>R$/L médio</span></div>
      </div>
      <p className="muted">Combustível {money(data.custo_combustivel)} · Manutenção {money(data.custo_manutencao)} · Lavagem {money(data.custo_lavagem)}</p>
      {(data.por_caminhao || []).map((c) => (
        <div key={c.caminhao_id} className="list-item">
          <div className="grow">
            <strong>{c.placa}</strong>
            <p className="muted" style={{ margin: 0 }}>{km(c.km_periodo)} · {money(c.custo_total)}</p>
          </div>
          <strong>{c.cpk != null ? `R$ ${Number(c.cpk).toFixed(3)}/km` : '—'}</strong>
        </div>
      ))}
    </>
  )
}

function Ranking({ data }) {
  if (!data.ranking?.length) return <EmptyState icon="🏅" title="Sem dados no período" />
  return data.ranking.map((r, i) => (
    <div key={r.motorista_id} className="list-item">
      <div className="truck-thumb">{i + 1}</div>
      <div className="grow">
        <strong>{r.nome}</strong>
        <p className="muted" style={{ margin: 0 }}>{r.quantidade} abastecimentos · {liters(r.litros)}</p>
      </div>
      <strong>{kmPerLiter(r.media_km_l)}</strong>
    </div>
  ))
}

function Disp({ data }) {
  return (
    <>
      <div className="kpi">
        <div className="kpi-card"><div className="num">{data.media_frota_pct != null ? `${data.media_frota_pct}%` : '—'}</div><span>Média da frota</span></div>
      </div>
      {(data.caminhoes || []).map((c) => (
        <div key={c.caminhao_id} className="list-item">
          <div className="grow">
            <strong>{c.placa}</strong>
            <p className="muted" style={{ margin: 0 }}>{c.dias_ativo} dias ativo · {c.dias_manutencao} em manutenção</p>
          </div>
          <strong>{c.disponibilidade_pct}%</strong>
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
