import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Shell from './components/Shell'
import Dashboard from './pages/Dashboard'
import Fleet from './pages/Fleet'
import TruckForm from './pages/TruckForm'
import TruckDetails from './pages/TruckDetails'
import Checklist from './pages/Checklist'
import TruckStatus from './pages/TruckStatus'
import Fueling from './pages/Fueling'
import FuelingConfirm from './pages/FuelingConfirm'
import Maintenance from './pages/Maintenance'
import Wash from './pages/Wash'
import Reports from './pages/Reports'
import Alerts from './pages/Alerts'
import More from './pages/More'
import Users from './pages/Users'
import ChangePassword from './pages/ChangePassword'
import AuditLogs from './pages/AuditLogs'

function Private({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

function Guest({ children }) {
  const { token } = useAuth()
  if (token) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <div className="device">
      <Routes>
        <Route path="/login" element={<Guest><Login /></Guest>} />
        <Route path="/criar-conta" element={<Guest><Register /></Guest>} />
        <Route path="/recuperar-senha" element={<Guest><ForgotPassword /></Guest>} />
        <Route path="/nova-senha" element={<Guest><ResetPassword /></Guest>} />
        <Route path="/app" element={<Private><Shell /></Private>}>
          <Route index element={<Dashboard />} />
          <Route path="frota" element={<Fleet />} />
          <Route path="frota/novo" element={<TruckForm />} />
          <Route path="frota/:id/editar" element={<TruckForm />} />
          <Route path="frota/:id" element={<TruckDetails />} />
          <Route path="frota/:id/checklist" element={<Checklist />} />
          <Route path="frota/:id/status" element={<TruckStatus />} />
          <Route path="frota/:id/manutencao" element={<Maintenance />} />
          <Route path="frota/:id/lavagem" element={<Wash />} />
          <Route path="abastecer" element={<Fueling />} />
          <Route path="abastecer/confirmacao" element={<FuelingConfirm />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="alertas" element={<Alerts />} />
          <Route path="mais" element={<More />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="senha" element={<ChangePassword />} />
          <Route path="auditoria" element={<AuditLogs />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </div>
  )
}
