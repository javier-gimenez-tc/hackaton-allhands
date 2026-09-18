import { formatQty } from '../engine/shopping'
import { formatDate, todayISO } from '../state/store'
import type { MealSlot, MenuEntry, PlanSpec, Recipe } from '../types'

interface Props {
  spec: PlanSpec
  menu: MenuEntry[]
  recipes: Map<string, Recipe>
  busy: boolean
  onOpenRecipe: (recipeId: string, servings: number) => void
  onReplace: (dayIndex: number, slot: MealSlot) => void
  onGoCalendar: () => void
}

export function TodayView({ spec, menu, recipes, busy, onOpenRecipe, onReplace, onGoCalendar }: Props) {
  const today = todayISO()
  // Si el plan empieza más adelante (o ya pasó), mostramos el primer día con comidas pendientes.
  const focusDate = menu.find((entry) => entry.date >= today)?.date ?? menu[0]?.date ?? spec.startDate
  const entries = menu.filter((entry) => entry.date === focusDate)
  const nextDate = menu.find((entry) => entry.date > focusDate)?.date
  const nextEntries = nextDate ? menu.filter((entry) => entry.date === nextDate) : []
  const isToday = focusDate === today

  if (!entries.length) {
    return (
      <p className="empty">
        No hay comidas planificadas para hoy.{' '}
        <button className="btn tiny subtle" type="button" onClick={onGoCalendar}>
          Ver el calendario
        </button>
      </p>
    )
  }

  return (
    <div className="today">
      <header className="today-head">
        <div>
          <span className="muted small">{isToday ? 'Hoy toca' : 'Próxima comida planificada'}</span>
          <h2>{formatDate(focusDate)}</h2>
        </div>
        <button className="btn ghost tiny" type="button" onClick={onGoCalendar}>
          📅 Ver la semana
        </button>
      </header>

      <div className="today-grid">
        {entries.map((entry) => {
          const recipe = recipes.get(entry.recipeId)
          const alt = entry.altRecipeId ? recipes.get(entry.altRecipeId) : undefined
          if (!recipe) return null

          return (
            <article className="card today-card" key={entry.id}>
              <span className="meal-slot">{entry.slot}</span>
              <h3>{recipe.name}</h3>

              <div className="row" style={{ gap: 6 }}>
                <span className="chip">⏱ {recipe.minutes} min</span>
                <span className="chip">🍽 {entry.servings} rac.</span>
                <span className="chip">🔥 {recipe.kcal} kcal</span>
                {recipe.tags.includes('vegano') && <span className="chip diet">vegano</span>}
              </div>

              <div className="today-cols">
                <div>
                  <h4>Ingredientes</h4>
                  <ul className="today-list">
                    {recipe.ingredients.slice(0, 6).map((ingredient) => (
                      <li key={ingredient.name}>
                        <span>{ingredient.name}</span>
                        <strong>{formatQty(ingredient.qty * entry.servings, ingredient.unit)}</strong>
                      </li>
                    ))}
                    {recipe.ingredients.length > 6 && (
                      <li className="muted small">+{recipe.ingredients.length - 6} más</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4>Primeros pasos</h4>
                  <ol className="today-steps">
                    {recipe.steps.slice(0, 3).map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
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
                  className="btn tiny"
                  type="button"
                  onClick={() => onOpenRecipe(entry.recipeId, entry.servings)}
                >
                  📖 Desarrollar receta
                </button>
                <button
                  className="btn tiny subtle"
                  type="button"
                  disabled={busy || entry.locked}
                  onClick={() => onReplace(entry.dayIndex, entry.slot)}
                >
                  🔄 Cambiar
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {nextEntries.length > 0 && (
        <div className="card today-next">
          <strong>Mañana ({formatDate(nextDate!)})</strong>
          <div className="row" style={{ gap: 8 }}>
            {nextEntries.map((entry) => (
              <button
                key={entry.id}
                className="chip"
                type="button"
                onClick={() => onOpenRecipe(entry.recipeId, entry.servings)}
              >
                {entry.slot}: {recipes.get(entry.recipeId)?.name ?? '—'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
