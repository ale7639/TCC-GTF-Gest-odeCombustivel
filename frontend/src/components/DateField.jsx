import { useEffect, useState } from 'react'
import { brToIso, isoToBr, maskDateBr } from '../utils/format'

/**
 * Campo de data em dd/mm/aaaa (pt-BR).
 * value/onChange usam ISO yyyy-mm-dd para a API; o usuário só vê o formato brasileiro.
 */
export default function DateField({
  label,
  value = '',
  onChange,
  required = false,
  id,
  hint,
  disabled = false,
}) {
  const [text, setText] = useState(() => isoToBr(value))

  useEffect(() => {
    setText(isoToBr(value || ''))
  }, [value])

  function handleChange(raw) {
    const masked = maskDateBr(raw)
    setText(masked)
    const iso = brToIso(masked)
    if (iso) onChange?.(iso)
    else if (masked === '') onChange?.('')
  }

  function handleBlur() {
    if (!text) {
      if (required) return
      onChange?.('')
      return
    }
    const iso = brToIso(text)
    if (iso) {
      setText(isoToBr(iso))
      onChange?.(iso)
    }
  }

  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        pattern="\d{2}/\d{2}/\d{4}"
        title="Use o formato dd/mm/aaaa"
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}
