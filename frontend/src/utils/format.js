export function liters(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' L'
}

export function km(value) {
  return Number(value || 0).toLocaleString('pt-BR') + ' km'
}

export function kmPerLiter(value) {
  if (value == null || value === '') return '—'
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' km/L'
}

export function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function roleLabel(role) {
  return {
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    motorista: 'Motorista',
  }[role] || role
}

export function dateBr(value, withTime = false) {
  if (!value) return '—'
  const raw = String(value)
  const [year, month, day] = raw.slice(0, 10).split('-')
  if (!day || !month || !year) return raw
  const date = `${day}/${month}/${year}`
  if (!withTime || raw.length < 16) return date
  return `${date} ${raw.slice(11, 16)}`
}

/** Data local YYYY-MM-DD (evita toISOString() em UTC virar “amanhã” no Brasil). */
export function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function digitsOnly(value) {
  return String(value || '').replace(/\D+/g, '')
}

/** Máscara visual 000.000.000-00 a partir dos dígitos. */
export function maskCpf(value) {
  const d = digitsOnly(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** ISO yyyy-mm-dd → dd/mm/aaaa (vazio se inválido). */
export function isoToBr(iso) {
  if (!iso) return ''
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** dd/mm/aaaa (ou dígitos) → yyyy-mm-dd; null se incompleto/inválido. */
export function brToIso(br) {
  const d = digitsOnly(br)
  if (d.length !== 8) return null
  const day = d.slice(0, 2)
  const month = d.slice(2, 4)
  const year = d.slice(4, 8)
  const iso = `${year}-${month}-${day}`
  const dt = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return null
  if (dt.getFullYear() !== Number(year) || dt.getMonth() + 1 !== Number(month) || dt.getDate() !== Number(day)) {
    return null
  }
  return iso
}

/** Máscara digitável dd/mm/aaaa. */
export function maskDateBr(value) {
  const d = digitsOnly(value).slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

export function firstName(name = '') {
  return name.split(' ')[0] || name
}

export function fieldError(error, field) {
  return error?.response?.data?.errors?.[field]?.[0]
}

export function apiMessage(error, fallback = 'Não foi possível concluir. Verifique a conexão e tente novamente.') {
  const data = error?.response?.data
  const fieldErrors = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : []
  const firstField = fieldErrors[0]
  const message = data?.message
  // Prefira mensagem de campo; ignore chaves cruas de tradução (ex.: validation.before_or_equal).
  if (firstField && !String(firstField).startsWith('validation.')) return firstField
  if (message && !String(message).startsWith('validation.')) return message
  if (firstField) return firstField
  return message || fallback
}

export function statusLabel(status) {
  return { ativo: 'Ativo', manutencao: 'Manutenção', inativo: 'Inativo' }[status] || status
}

export function statusBadge(status) {
  if (status === 'ativo') return 'badge-ok'
  if (status === 'manutencao') return 'badge-pendente'
  return 'badge-nao_apto'
}

export function oleoLabel(alerta) {
  return {
    ok: 'Em dia',
    proximo: 'Próximo',
    atrasado: 'Atrasado',
    sem_registro: 'Sem registro',
  }[alerta] || alerta || '—'
}

export function oleoBadge(alerta) {
  if (alerta === 'ok') return 'badge-ok'
  if (alerta === 'proximo') return 'badge-pendente'
  if (alerta === 'atrasado') return 'badge-nao_apto'
  return 'badge-pendente'
}
