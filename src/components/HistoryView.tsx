import type { HistoryEntry } from '../state/session'
import { formatDate } from '../state/store'

interface Props {
  history: HistoryEntry[]
  currentId: string | null
  onOpen: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
}

const relative = (timestamp: number): string => {
  const days = Math.round((Date.now() - timestamp) / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  if (days < 14) return 'la semana pasada'
  return `hace ${Math.floor(days / 7)} semanas`
}

export function HistoryView({ history, currentId, onOpen, onDelete }: Props) {
  if (!history.length) {
    return <p className="empty">Todavía no has guardado ningún plan.</p>
  }

  return (
    <div className="history">
      {history.map((entry) => {
        const dishes = new Set(entry.menu.map((meal) => meal.recipeId)).size
        const vegans = entry.spec.people.filter((p) => p.diets.includes('vegano')).length

        return (
          <article className={`card history-card${entry.id === currentId ? ' active' : ''}`} key={entry.id}>
            <header>
              <div>
                <strong>Semana del {formatDate(entry.spec.startDate)}</strong>
                <div className="muted small">
                  {relative(entry.createdAt)} · {entry.spec.people.length} comensales
                  {vegans > 0 && ` · ${vegans} vegano${vegans > 1 ? 's' : ''}`}
                </div>
              </div>
              {entry.order ? (
                <span className="badge">🚚 pedido {entry.order.reference}</span>
              ) : (
                <span className="badge neutral">sin pedir</span>
              )}
            </header>

            <p className="muted small history-prompt">“{entry.prompt}”</p>

            <div className="row" style={{ gap: 6 }}>
              <span className="chip">🍽 {entry.menu.length} comidas</span>
              <span className="chip">📖 {dishes} recetas</span>
              <span className="chip">🛒 {entry.shopping.length} productos</span>
              {entry.source === 'ai' && <span className="chip diet">✨ IA</span>}
            </div>

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn tiny subtle" type="button" onClick={() => onOpen(entry)}>
                {entry.id === currentId ? 'Plan abierto' : 'Abrir de nuevo'}
              </button>
              <button className="btn tiny ghost" type="button" onClick={() => onDelete(entry.id)}>
                Eliminar
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
