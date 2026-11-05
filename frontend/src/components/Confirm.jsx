export default function Confirm({ title, text, onCancel, onConfirm, danger, confirmLabel = 'Confirmar' }) {
  return (
    <div className="overlay" role="dialog" aria-modal>
      <div className="modal">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <div className="actions">
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn btn-soft" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
