import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Confirm from '../components/Confirm'
import { useAuth } from '../context/AuthContext'
import { apiMessage, dateBr, km, kmPerLiter, liters, oleoBadge, oleoLabel, statusBadge, statusLabel } from '../utils/format'

export default function TruckDetails() {
  const { id } = useParams()
  const { isAdmin, isGestao } = useAuth()
  const navigate = useNavigate()
  const [c, setC] = useState(null)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    api.get(`/caminhoes/${id}`).then(({ data }) => setC(data)).catch((err) => setError(apiMessage(err)))
  }, [id])

  async function excluir() {
    try {
      await api.delete(`/caminhoes/${id}`)
      navigate('/app/frota')
    } catch (err) {
      setError(apiMessage(err))
      setConfirmDel(false)
    }
  }

  if (error && !c) return <div className="scroll"><div className="banner banner-danger">{error}</div></div>
  if (!c) return <div className="scroll"><p className="muted">Carregando…</p></div>
  const wa = c.motorista?.whatsapp_url

  return (
    <div className="scroll stack">
      <Link className="link" to="/app/frota">← Frota</Link>
      <div className="row space">
        <div>
          <p className="eyebrow">{c.modelo}</p>
          <h1 className="plate">{c.placa}</h1>
        </div>
        <span className={`badge ${statusBadge(c.status)}`}>{statusLabel(c.status)}</span>
      </div>
      <div className="card mini">
        <div><span>KM</span><strong>{km(c.km_atual)}</strong></div>
        <div><span>Média</span><strong>{kmPerLiter(c.media_km_l)}</strong></div>
        <div><span>Meta</span><strong>{kmPerLiter(c.meta_km_l)}</strong></div>
        <div><span>Motorista</span><strong>{c.motorista?.nome || '—'}</strong></div>
      </div>
      {(c.crlv_validade || c.seguro_validade) && (
        <p className="muted" style={{ margin: 0 }}>
          CRLV {dateBr(c.crlv_validade)} · Seguro {dateBr(c.seguro_validade)}
        </p>
      )}
      {c.oleo && (
        <Link className={`card oleo-card alerta-${c.oleo.alerta}`} to={`/app/frota/${id}/manutencao`} style={{ textDecoration: 'none' }}>
          <div className="row space">
            <div>
              <p className="eyebrow">Óleo</p>
              <strong>{c.oleo.rotulo}</strong>
            </div>
            <span className={`badge ${oleoBadge(c.oleo.alerta)}`}>{oleoLabel(c.oleo.alerta)}</span>
          </div>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Última {dateBr(c.oleo.ultima_data)} · próxima {c.oleo.proxima_km != null ? km(c.oleo.proxima_km) : '—'}
          </p>
        </Link>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {wa && <a className="btn btn-wa" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
        {isAdmin && <Link className="btn btn-soft" style={{ width: 'auto' }} to={`/app/frota/${id}/editar`}>Editar</Link>}
        <Link className="btn btn-soft" style={{ width: 'auto' }} to={`/app/frota/${id}/lavagem`}>Lavagem</Link>
        <Link className="btn btn-soft" style={{ width: 'auto' }} to={`/app/frota/${id}/manutencao`}>Manutenção</Link>
        <Link className="btn btn-soft" style={{ width: 'auto' }} to={`/app/frota/${id}/pneus`}>Pneus</Link>
        <Link className="btn btn-soft" style={{ width: 'auto' }} to="/app/saida">Checklist saída</Link>
      </div>
      <h2>Abastecimentos</h2>
      <div className="list">
        {(c.abastecimentos || []).length === 0 && <p className="muted">Nenhum abastecimento neste caminhão.</p>}
        {(c.abastecimentos || []).map((a) => (
          <div key={a.id} className="card">
            <div className="row space">
              <strong>{dateBr(a.data)}</strong>
              <span className={`badge ${a.origem === 'externo' ? 'badge-pendente' : 'badge-ok'}`}>
                {a.origem === 'externo' ? 'Posto' : 'Base'}
              </span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {liters(a.litros)} · {km(a.km)} · trecho {kmPerLiter(a.km_l)}
            </p>
            {a.comprovante_url && (
              <img className="preview" style={{ marginTop: 10 }} src={a.comprovante_url} alt="Cupom do posto" />
            )}
          </div>
        ))}
      </div>
      {isAdmin && <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>Excluir / desativar</button>}
      {confirmDel && (
        <Confirm
          danger
          title="Desativar este caminhão?"
          text="Se já houver histórico, ele só é desativado. O combustível registrado permanece."
          confirmLabel="Desativar"
          onCancel={() => setConfirmDel(false)}
          onConfirm={excluir}
        />
      )}
      {error && c && <div className="banner banner-danger">{error}</div>}
      {isGestao ? null : null}
    </div>
  )
}
