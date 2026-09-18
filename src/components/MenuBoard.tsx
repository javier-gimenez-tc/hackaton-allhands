import type { MealSlot, MenuEntry, PlanSpec, Recipe } from '../types'
import { formatDate } from '../state/store'

interface Props {
  spec: PlanSpec
  menu: MenuEntry[]
  recipes: Map<string, Recipe>
  busy: boolean
  onOpenRecipe: (recipeId: string, servings: number) => void
  onReplace: (dayIndex: number, slot: MealSlot) => void
  onToggleLock: (entryId: string) => void
}

export function MenuBoard({ spec, menu, recipes, busy, onOpenRecipe, onReplace, onToggleLock }: Props) {
  const days = Array.from({ length: spec.days }, (_, dayIndex) => ({
    dayIndex,
    entries: menu.filter((entry) => entry.dayIndex === dayIndex),
  }))

  return (
    <div className="day-grid">
      {days.map(({ dayIndex, entries }) => (
        <article className="card day-card" key={dayIndex}>
          <header className="day-head">
            <h3>{formatDate(entries[0]?.date ?? spec.startDate)}</h3>
            <span className="muted small">Día {dayIndex + 1}</span>
          </header>

          {entries.length === 0 && <p className="muted small">Sin comidas planificadas.</p>}

          {entries.map((entry) => {
            const recipe = recipes.get(entry.recipeId)
            const alt = entry.altRecipeId ? recipes.get(entry.altRecipeId) : undefined

            return (
              <div className={`meal${entry.locked ? ' locked' : ''}`} key={entry.id}>
                <span className="meal-slot">{entry.slot}</span>

                <button
                  type="button"
                  className="meal-name"
                  onClick={() => onOpenRecipe(entry.recipeId, entry.servings)}
                >
                  {recipe?.name ?? 'Receta no disponible'}
                </button>

                <div className="row" style={{ gap: 6 }}>
                  {recipe && <span className="chip">⏱ {recipe.minutes} min</span>}
                  <span className="chip">🍽 {entry.servings} rac.</span>
                  {recipe?.tags.includes('vegano') && <span className="chip diet">vegano</span>}
                </div>

                {alt && entry.altServings > 0 && (
                  <button
                    type="button"
                    className="meal-alt"
                    onClick={() => onOpenRecipe(alt.id, entry.altServings)}
                  >
                    <span>🌱</span>
                    <span>
                      <strong>{alt.name}</strong> · {entry.altServings} rac. adaptadas
                    </span>
                  </button>
                )}

                <div className="meal-actions">
                  <button
                    className="btn tiny subtle"
                    type="button"
                    disabled={busy || entry.locked}
                    onClick={() => onReplace(entry.dayIndex, entry.slot)}
                  >
                    🔄 Cambiar
                  </button>
                  <button
                    className="btn tiny ghost"
                    type="button"
                    onClick={() => onToggleLock(entry.id)}
                    title="Bloquear para que no cambie al regenerar"
                  >
                    {entry.locked ? '🔒 Fijada' : '🔓 Fijar'}
                  </button>
                </div>
              </div>
            )
          })}
        </article>
      ))}
    </div>
  )
}
