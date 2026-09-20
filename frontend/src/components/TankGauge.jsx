import { liters } from '../utils/format'

export default function TankGauge({ current, percent, critical }) {
  return (
    <section className={`tank ${critical ? 'critical' : ''}`}>
      <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>Tanque principal</p>
      <div className="num">{liters(current)}</div>
      <p style={{ margin: '6px 0 0', opacity: .8 }}>Disponíveis · {percent}%</p>
      <div className="progress" aria-label={`Nível do tanque ${percent}%`}>
        <span style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      {critical && <p style={{ margin: '12px 0 0', fontWeight: 700 }}>Combustível baixo — abasteça o tanque central.</p>}
    </section>
  )
}
