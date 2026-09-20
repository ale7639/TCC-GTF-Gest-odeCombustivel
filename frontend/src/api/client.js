import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gfc_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthRoute = ['/login', '/register', '/forgot-password', '/reset-password'].some((path) => url.includes(path))
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('gfc_token')
      localStorage.removeItem('gfc_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  }
)

export default api
