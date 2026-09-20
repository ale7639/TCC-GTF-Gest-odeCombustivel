export function liters(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' L'
}

export function km(value) {
  return Number(value || 0).toLocaleString('pt-BR') + ' km'
}

export function kmPerLiter(value) {
  if (value == null || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' km/L'
}

export function roleLabel(role) {
  return {
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    motorista: 'Motorista',
  }[role] || role
}

export function dateBr(value) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return day && month && year ? `${day}/${month}/${year}` : String(value)
}

export function firstName(name = '') {
  return name.split(' ')[0] || name
}

export function fieldError(error, field) {
  return error?.response?.data?.errors?.[field]?.[0]
}

export function apiMessage(error, fallback = 'Não foi possível concluir. Verifique a conexão e tente novamente.') {
  return error?.response?.data?.message || fallback
}
