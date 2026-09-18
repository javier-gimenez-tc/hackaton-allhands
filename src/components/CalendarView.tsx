import { formatDate } from '../state/store'
import type { MenuEntry, PlanSpec, Recipe } from '../types'

interface Props {
  spec: PlanSpec
  menu: MenuEntry[]
  recipes: Map<string, Recipe>
  onOpenRecipe: (recipeId: string, servings: number) => void
}

export function CalendarView({ spec, menu, recipes, onOpenRecipe }: Props) {
  if (!menu.length) return <p className="empty">Aún no hay menú que mostrar en el calendario.</p>

  const days = Array.from({ length: spec.days }, (_, dayIndex) => ({
    dayIndex,
    entries: menu.filter((entry) => entry.dayIndex === dayIndex),
  }))

  const totalKcal = (entries: MenuEntry[]) =>
    entries.reduce((sum, entry) => sum + (recipes.get(entry.recipeId)?.kcal ?? 0), 0)

  return (
    <div className="calendar">
      {days.map(({ dayIndex, entries }) => (
        <article className="card cal-day" key={dayIndex}>
          <header>{formatDate(entries[0]?.date ?? spec.startDate)}</header>

          {entries.map((entry) => {
            const recipe = recipes.get(entry.recipeId)
            const alt = entry.altRecipeId ? recipes.get(entry.altRecipeId) : undefined
            return (
              <div key={entry.id} style={{ display: 'grid', gap: 4 }}>
                <button
                  type="button"
                  className="cal-meal"
                  onClick={() => onOpenRecipe(entry.recipeId, entry.servings)}
                >
                  <em>{entry.slot}</em>
                  {recipe?.name ?? '—'}
                </button>
                {alt && entry.altServings > 0 && (
                  <button
                    type="button"
                    className="cal-meal"
                    style={{ background: 'var(--green-soft)', borderColor: 'transparent' }}
                    onClick={() => onOpenRecipe(alt.id, entry.altServings)}
                  >
                    <em>🌱 adaptada</em>
                    {alt.name}
                  </button>
                )}
              </div>
            )
          })}

          {entries.length > 0 && (
            <span className="muted small">~{totalKcal(entries)} kcal / persona</span>
          )}
        </article>
      ))}
    </div>
  )
}
