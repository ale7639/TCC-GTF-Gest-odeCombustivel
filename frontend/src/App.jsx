import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Shell from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Fleet from './pages/Fleet'
import TruckForm from './pages/TruckForm'
import TruckDetails from './pages/TruckDetails'
import Drivers from './pages/Drivers'
import Tanks from './pages/Tanks'
import TankDetails from './pages/TankDetails'
import Fueling from './pages/Fueling'
import ReportsHub from './pages/ReportsHub'
import ReportPage from './pages/ReportPage'
import Users from './pages/Users'
import Wash from './pages/Wash'
import Maintenance from './pages/Maintenance'

function Private({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

function Gestao({ children }) {
  const { isGestao } = useAuth()
  return isGestao ? children : <Navigate to="/app" replace />
}

function Admin({ children }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/app" replace />
}

export default function App() {
  return (
    <div className="device">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<Private><Shell /></Private>}>
          <Route index element={<Dashboard />} />
          <Route path="frota" element={<Fleet />} />
          <Route path="frota/novo" element={<Admin><TruckForm /></Admin>} />
          <Route path="frota/:id" element={<TruckDetails />} />
          <Route path="frota/:id/editar" element={<Admin><TruckForm /></Admin>} />
          <Route path="frota/:id/lavagem" element={<Wash />} />
          <Route path="frota/:id/manutencao" element={<Maintenance />} />
          <Route path="motoristas" element={<Gestao><Drivers /></Gestao>} />
          <Route path="tanques" element={<Tanks />} />
          <Route path="tanques/:id" element={<TankDetails />} />
          <Route path="abastecer" element={<Fueling />} />
          <Route path="relatorios" element={<Gestao><ReportsHub /></Gestao>} />
          <Route path="relatorios/:tipo" element={<Gestao><ReportPage /></Gestao>} />
          <Route path="usuarios" element={<Admin><Users /></Admin>} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </div>
  )
}
