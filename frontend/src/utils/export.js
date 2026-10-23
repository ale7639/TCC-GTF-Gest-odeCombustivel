/** Exporta linhas (array de objetos) como CSV e dispara download. */
export function downloadCsv(filename, rows) {
  if (!rows?.length) return
  const keys = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [keys.join(';'), ...rows.map((r) => keys.map((k) => esc(r[k])).join(';'))]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function printReport() {
  window.print()
}
