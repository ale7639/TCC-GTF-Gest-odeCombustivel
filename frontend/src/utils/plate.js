export function normalizePlate(value = '') {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^[A-Z]{3}\d{4}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`
  }
  return clean.slice(0, 7)
}

export function isValidPlate(value = '') {
  const plate = normalizePlate(value)
  return /^([A-Z]{3}-\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/.test(plate)
}
