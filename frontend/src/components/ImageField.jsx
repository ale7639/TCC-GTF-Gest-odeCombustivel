import { useEffect, useState } from 'react'

export default function ImageField({ label, file, onChange, existingUrl, hint }) {
  const [preview, setPreview] = useState(existingUrl || null)

  useEffect(() => {
    if (!file) {
      setPreview(existingUrl || null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, existingUrl])

  return (
    <div className="field">
      <label>{label}</label>
      <input type="file" accept="image/*" capture="environment" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {hint && <span className="hint">{hint}</span>}
      {preview && <img className="preview" src={preview} alt="Prévia do comprovante" />}
    </div>
  )
}
