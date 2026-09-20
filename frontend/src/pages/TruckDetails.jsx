import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import { km, liters, dateBr, apiMessage } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function TruckDetails() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [truck, setTruck] = useState(null)
  const [fuelings, setFuelings] = useState([])
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/trucks/${id}`).then(({ data }) => setTruck(data.data))
      .catch((err) => setError(apiMessage(err, 'Não foi possível carregar o caminhão.')))
    api.get(`/trucks/${id}/fuelings`).then(({ data }) => setFuelings(data.data || [])).catch(() => {})
  }, [id])

  async function remove() {
    await api.delete(`/trucks/${id}`)
    navigate('/app/frota')
  }

  if (!truck) return <div className="scroll"><p className="muted">{error || 'Carregando...'}</p></div>

  return (
    <div className="scroll">
      <div className="topbar">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
        {isAdmin && (
          <Link to={`/app/frota/${id}/editar`} className="btn-icon" aria-label="Editar caminhão">✎</Link>
        )}
      </div>
      <div className="row space">
        <div>
          <div className="plate">{truck.plate}</div>
          <h2>{truck.model}</h2>
          <p className="muted">{truck.name} · {truck.sector}</p>
        </div>
        <StatusBadge status={truck.checklist?.result} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="stack">
          <p><strong>Combustível</strong><br />{truck.fuel_type} · {liters(truck.current_liters)} de {liters(truck.tank_capacity)}</p>
          <p><strong>Quilometragem</strong><br />{km(truck.current_km)}</p>
          <p><strong>Motorista</strong><br />{truck.driver?.name || 'Não atribuído'}</p>
          <p><strong>Documentação</strong><br />
            CRLV {dateBr(truck.crlv_expires_at)} · Seguro {dateBr(truck.insurance_expires_at)} · Licenciamento {dateBr(truck.license_expires_at)}
          </p>
        </div>
      </div>
      <div className="quick">
        <Link to={`/app/frota/${id}/manutencao`}>Manutenção</Link>
        <Link to={`/app/frota/${id}/lavagem`}>Lavagem</Link>
        <Link to={`/app/abastecer?truck=${id}`}>Abastecer</Link>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        <Link className="btn btn-soft" to={`/app/frota/${id}/checklist`}>Abrir checklist</Link>
        <Link className="btn btn-soft" to={`/app/frota/${id}/status`}>Ver status da escala</Link>
        {isAdmin && <button className="btn btn-danger" onClick={() => setConfirm(true)}>Excluir caminhão</button>}
      </div>
      <h2 style={{ marginTop: 24 }}>Últimos abastecimentos</h2>
      <div className="list" style={{ marginTop: 10 }}>
        {fuelings.length === 0 && <p className="muted">Nenhum abastecimento registrado ainda.</p>}
        {fuelings.map((item) => (
          <div className="list-item" key={item.id}>
            <div className="grow">
              <strong>{liters(item.quantity)}</strong>
              <div className="muted">{item.created_at} · {item.responsible}{item.km ? ` · ${km(item.km)}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
      {confirm && (
        <Modal title="Excluir caminhão?" onClose={() => setConfirm(false)}>
          <p className="muted">O veículo <strong>{truck.plate}</strong> será desativado. A ação não pode ser desfeita na listagem — o registro fica na auditoria.</p>
          <div className="actions">
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={remove}>Sim, excluir</button>
            <button className="btn btn-soft" onClick={() => setConfirm(false)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
