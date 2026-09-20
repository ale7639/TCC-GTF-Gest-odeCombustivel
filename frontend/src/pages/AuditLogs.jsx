import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import api from '../api/client'
import EmptyState from '../components/EmptyState'
import { apiMessage } from '../utils/format'
import { useAuth } from '../context/AuthContext'

const labels = {
  'auth.login': 'Login',
  'auth.senha': 'Troca de senha',
  'auth.register': 'Cadastro',
  'abastecimento.criar': 'Abastecimento',
  'tanque.reabastecer': 'Tanque central',
  'caminhao.criar': 'Cadastro de caminhão',
  'caminhao.editar': 'Edição de caminhão',
  'caminhao.excluir': 'Exclusão de caminhão',
  'caminhao.desativar': 'Desativação de caminhão',
  'caminhao.importar': 'Importação de frota',
  'usuario.perfil': 'Perfil de usuário',
  'lavagem.criar': 'Lavagem',
}

export default function AuditLogs() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    api.get('/audit-logs').then(({ data }) => setItems(data.data)).catch((err) => setError(apiMessage(err)))
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/app/mais" replace />
  if (!items && !error) return <div className="scroll"><p className="muted">Carregando auditoria...</p></div>

  return (
    <div className="scroll">
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
      <h1>Auditoria</h1>
      <p className="muted">Últimas ações registradas no sistema.</p>
      {error && <div className="banner banner-danger">{error}</div>}
      {items?.length === 0 ? (
        <EmptyState icon="🗂️" title="Sem registros ainda" text="As ações de login, abastecimento e cadastro aparecem aqui." />
      ) : (
        <div className="list" style={{ marginTop: 16 }}>
          {items?.map((item) => (
            <div className="list-item" key={item.id}>
              <div className="grow">
                <strong>{labels[item.action] || item.action}</strong>
                <div className="muted">{item.user || 'Sistema'} · {item.created_at}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
