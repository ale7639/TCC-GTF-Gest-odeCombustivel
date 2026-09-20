export function passwordScore(password = '') {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (password.length >= 12) score += 1

  const labels = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte']
  const colors = ['#b42318', '#c98912', '#c98912', '#2f7a55', '#1c4d3a']
  const index = Math.max(0, Math.min(labels.length - 1, score - 1))

  return {
    score,
    valid: password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password),
    label: password ? labels[index] : '',
    color: colors[index],
    width: `${Math.min(100, score * 20)}%`,
  }
}
