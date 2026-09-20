export default function EmptyState({ icon = '🚛', title, text, children }) {
  return (
    <div className="empty card">
      <div className="illus" aria-hidden="true">{icon}</div>
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <div className="stack" style={{ marginTop: 16 }}>{children}</div>
    </div>
  )
}
