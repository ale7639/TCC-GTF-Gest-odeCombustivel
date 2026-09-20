import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import { apiMessage } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function Fleet() {
  const { isAdmin } = useAuth()
  const [trucks, setTrucks] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  async function load(nextQ = q, nextStatus = status) {
    const params = new URLSearchParams({ with_checklist: '1' })
    if (nextQ) params.set('q', nextQ)
    if (nextStatus) params.set('status', nextStatus)
    try {
      const { data } = await api.get(`/trucks?${params}`)
      setTrucks(data.data)
      setError('')
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível carregar a frota.'))
      setTrucks([])
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { load() }, 200)
    return () => clearTimeout(timer)
  }, [q, status])

  async function importSheet(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    try {
      await api.post('/trucks/import', body)
      event.target.value = ''
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Não foi possível importar a planilha.'))
    }
  }

  const emptySearch = useMemo(() => trucks && trucks.length === 0 && (q || status), [trucks, q, status])

  const importControls = isAdmin && (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importSheet} />
      <button className="btn btn-soft" type="button" onClick={() => fileRef.current?.click()}>Importar CSV</button>
    </>
  )

  if (trucks === null) return <div className="scroll"><p className="muted">Carregando frota...</p></div>

  if (trucks.length === 0 && !q && !status) {
    return (
      <div className="scroll">
        <div className="topbar"><h1>Frota</h1></div>
        {error && <div className="banner banner-danger">{error}</div>}
        <EmptyState
          title="Sua frota ainda está vazia"
          text={isAdmin
            ? 'Cadastre o primeiro caminhão para começar a controlar combustível, manutenção e lavagem.'
            : 'Nenhum caminhão está vinculado ao seu usuário. Peça ao administrador para atribuir um veículo.'}
        >
          {isAdmin && <Link className="btn btn-primary" to="/app/frota/novo">Cadastrar primeiro caminhão</Link>}
          {importControls}
          {isAdmin && <a className="link" href="/modelo-frota.csv">Ver modelo CSV</a>}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="scroll">
      <div className="topbar">
        <div>
          <p className="eyebrow">Controle de frota</p>
          <h1>Caminhões</h1>
        </div>
        {isAdmin && <Link className="btn btn-primary" style={{ width: 'auto', padding: '10px 14px' }} to="/app/frota/novo">Novo</Link>}
      </div>
      <div className="stack">
        {error && <div className="banner banner-danger">{error}</div>}
        <div className="search-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
          <input className="search" placeholder="Buscar por placa ou modelo" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filters">
          {[['','Todos'],['apto','Apto'],['pendente','Pendente'],['nao_apto','Não apto']].map(([value, label]) => (
            <button key={value} className={`chip ${status === value ? 'on' : ''}`} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
        {isAdmin && <div className="row">{importControls}<a className="link" href="/modelo-frota.csv">Modelo CSV</a></div>}
        {emptySearch ? (
          <EmptyState icon="🔎" title="Nenhum veículo encontrado" text="Tente outra placa ou limpe o filtro." />
        ) : (
          <div className="list">
            {trucks.map((truck) => (
              <Link key={truck.id} className="list-item" to={`/app/frota/${truck.id}`}>
                <div className="truck-thumb">{truck.plate.slice(0, 3)}</div>
                <div className="grow">
                  <div className="plate">{truck.plate}</div>
                  <div className="muted">{truck.model} · {truck.name}</div>
                </div>
                <StatusBadge status={truck.checklist?.result} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
