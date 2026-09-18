import { formatDate } from '../state/store'
import type { MenuEntry, PlanSpec, Recipe } from '../types'

interface Props {
  spec: PlanSpec
  menu: MenuEntry[]
  recipes: Map<string, Recipe>
  onOpenRecipe: (recipeId: string, servings: number) => void
}

const WEEK_LABELS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const parseISO = (value: string) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
const toISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
/** Lunes como primer día de la semana, que es como se lee un calendario en España. */
const mondayIndex = (date: Date) => (date.getDay() + 6) % 7

export function CalendarView({ spec, menu, recipes, onOpenRecipe }: Props) {
  if (!menu.length) return <p className="empty">Aún no hay menú que mostrar en el calendario.</p>

  const start = parseISO(menu[0]?.date ?? spec.startDate)
  const gridStart = new Date(start)
  gridStart.setDate(start.getDate() - mondayIndex(start))

  const lastDate = parseISO(menu[menu.length - 1]?.date ?? spec.startDate)
  const weeks = Math.ceil((Math.round((lastDate.getTime() - gridStart.getTime()) / 86_400_000) + 1) / 7)

  const cells = Array.from({ length: Math.max(1, weeks) * 7 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const iso = toISO(date)
    return { date, iso, entries: menu.filter((entry) => entry.date === iso) }
  })

  const today = toISO(new Date())
  const months = [...new Set(cells.map((cell) => MONTHS[cell.date.getMonth()]))].join(' / ')
  const kcal = (entries: MenuEntry[]) =>
    entries.reduce((sum, entry) => sum + (recipes.get(entry.recipeId)?.kcal ?? 0), 0)

  return (
    <div>
      <header className="cal-head">
        <h2>
          {months} {start.getFullYear()}
        </h2>
        <span className="muted small">
          Plan del {formatDate(menu[0].date)} al {formatDate(menu[menu.length - 1].date)}
        </span>
      </header>

      <div className="cal-scroll">
        <div className="cal-grid">
          {WEEK_LABELS.map((label) => (
            <div className="cal-weekday" key={label}>
              {label}
            </div>
          ))}

          {cells.map(({ date, iso, entries }) => (
            <div
              className={`cal-cell${entries.length ? ' planned' : ''}${iso === today ? ' today' : ''}`}
              key={iso}
            >
              <span className="cal-num">{date.getDate()}</span>

              {entries.map((entry) => {
                const recipe = recipes.get(entry.recipeId)
                const alt = entry.altRecipeId ? recipes.get(entry.altRecipeId) : undefined
                return (
                  <div key={entry.id} className="cal-slot">
                    <button
                      type="button"
                      className="cal-meal"
                      onClick={() => onOpenRecipe(entry.recipeId, entry.servings)}
                      title={recipe?.name}
                    >
                      <em>{entry.slot}</em>
                      {recipe?.name ?? '—'}
                    </button>
                    {alt && entry.altServings > 0 && (
                      <button
                        type="button"
                        className="cal-meal veg"
                        onClick={() => onOpenRecipe(alt.id, entry.altServings)}
                        title={alt.name}
                      >
                        <em>🌱 adaptada</em>
                        {alt.name}
                      </button>
                    )}
                  </div>
                )
              })}

              {entries.length > 0 && <span className="cal-kcal">~{kcal(entries)} kcal</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
