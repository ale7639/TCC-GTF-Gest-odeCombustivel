import { createContext, useContext, useMemo, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gfc_user') || 'null') } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('gfc_token'))

  const value = useMemo(() => {
    const role = user?.role
    return {
      user,
      token,
      isAdmin: role === 'administrador',
      isGestao: role === 'administrador' || role === 'supervisor',
      isMotorista: role === 'motorista',
      async login(email, password) {
        const { data } = await api.post('/login', { email, password })
        localStorage.setItem('gfc_token', data.token)
        localStorage.setItem('gfc_user', JSON.stringify(data.user))
        setToken(data.token)
        setUser(data.user)
        return data.user
      },
      async logout() {
        try { await api.post('/logout') } catch { /* ignore */ }
        localStorage.removeItem('gfc_token')
        localStorage.removeItem('gfc_user')
        setToken(null)
        setUser(null)
      },
    }
  }, [user, token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
