export default function Modal({ title, children, onClose }) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}
