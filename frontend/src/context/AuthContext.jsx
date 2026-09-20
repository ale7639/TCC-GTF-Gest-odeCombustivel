import { createContext, useContext, useMemo, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('gfc_user')
    return raw ? JSON.parse(raw) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('gfc_token'))

  const value = useMemo(() => {
    function persist(nextToken, nextUser) {
      setToken(nextToken)
      setUser(nextUser)
      if (nextToken) localStorage.setItem('gfc_token', nextToken)
      else localStorage.removeItem('gfc_token')
      if (nextUser) localStorage.setItem('gfc_user', JSON.stringify(nextUser))
      else localStorage.removeItem('gfc_user')
    }

    return {
      user,
      token,
      isAdmin: user?.role === 'administrador',
      isSupervisor: user?.role === 'supervisor',
      canManage: ['administrador', 'supervisor'].includes(user?.role),
      canReport: ['administrador', 'supervisor'].includes(user?.role),
      async login(email, password) {
        const { data } = await api.post('/login', { email, password })
        persist(data.token, data.user)
        return data
      },
      async logout() {
        try { await api.post('/logout') } catch {}
        persist(null, null)
      },
    }
  }, [user, token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
