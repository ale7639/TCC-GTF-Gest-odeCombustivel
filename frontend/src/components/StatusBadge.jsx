export default function StatusBadge({ status, label }) {
  const map = {
    apto: 'Pronto',
    pendente: 'Pendente',
    nao_apto: 'Não apto',
    ok: 'Em dia',
  }
  return (
    <span className={`badge badge-${status}`}>
      <span className="dot" aria-hidden="true" />
      {label || map[status] || status}
    </span>
  )
}
