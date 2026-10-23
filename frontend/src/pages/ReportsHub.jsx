import { Link } from 'react-router-dom'

const cards = [
  { to: '/app/relatorios/acesso', title: 'Log de acesso', text: 'Quem entrou e o que foi gravado no sistema.' },
  { to: '/app/relatorios/km', title: 'Quilometragem', text: 'KM atual e média de cada caminhão.' },
  { to: '/app/relatorios/abastecimentos', title: 'Abastecimentos', text: 'Base e posto, com foto do cupom quando houver.' },
  { to: '/app/relatorios/consumo', title: 'Consumo', text: 'Litros do período, ranking e km/L.' },
  { to: '/app/relatorios/notas', title: 'Notas fiscais', text: 'Últimas entradas de combustível na base.' },
]

export default function ReportsHub() {
  return (
    <div className="scroll stack">
      <p className="eyebrow">Gestão</p>
      <h1>Relatórios</h1>
      <p className="muted">Histórico organizado do que aconteceu na operação — não só o gráfico do mês.</p>
      {cards.map((c) => (
        <Link key={c.to} className="list-item" to={c.to}>
          <div className="grow">
            <strong>{c.title}</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>{c.text}</p>
          </div>
          <span aria-hidden>→</span>
        </Link>
      ))}
    </div>
  )
}
