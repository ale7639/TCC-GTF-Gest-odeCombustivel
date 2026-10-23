export default function EmptyState({ icon = '—', title, text, action }) {
  return (
    <div className="empty">
      <div className="illus" aria-hidden>{icon}</div>
      <h2>{title}</h2>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  )
}
