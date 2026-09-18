import type { AppState, MealSlot, MenuEntry, PlanSpec, Recipe } from '../types'

const STORAGE_KEY = 'mercaplan:state'
export const STATE_VERSION = 4

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export const formatDate = (isoDate: string): string =>
  new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })

export const emptySpec = (): PlanSpec => ({
  people: [{ id: 'p1', name: 'Comensal 1', diets: [] }],
  days: 7,
  startDate: todayISO(),
  slots: ['comida', 'cena'],
  maxMinutes: 45,
  excluded: [],
  notes: [],
})

export const emptyState = (): AppState => ({
  version: STATE_VERSION,
  historyId: null,
  prompt: '',
  spec: emptySpec(),
  recipes: [],
  menu: [],
  shopping: [],
  chat: [],
  generatedAt: null,
  source: null,
})

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as AppState
    if (parsed?.version !== STATE_VERSION) return emptyState()
    return { ...emptyState(), ...parsed }
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Cuota llena o modo privado: la app sigue funcionando sin caché.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignorado a propósito
  }
}

/** Reparte comensales entre la receta principal y la alternativa según dietas. */
export function servingsFor(
  spec: PlanSpec,
  recipe: Recipe | undefined,
  hasAlt: boolean,
): { main: number; alt: number } {
  if (!recipe) return { main: spec.people.length, alt: 0 }
  if (!hasAlt) return { main: spec.people.length, alt: 0 }

  const incompatible = spec.people.filter(
    (person) => !person.diets.every((diet) => recipe.tags.includes(diet)),
  ).length

  return { main: Math.max(0, spec.people.length - incompatible), alt: incompatible }
}

export function toMenuEntries(
  raw: Array<{ dayIndex: number; slot: MealSlot; recipeId: string; altRecipeId: string | null }>,
  spec: PlanSpec,
  recipes: Recipe[],
  previous: MenuEntry[] = [],
): MenuEntry[] {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const locked = new Map(previous.filter((e) => e.locked).map((e) => [`${e.dayIndex}:${e.slot}`, e]))

  return raw
    .map((entry) => {
      const key = `${entry.dayIndex}:${entry.slot}`
      const keep = locked.get(key)
      if (keep) return keep

      const recipe = byId.get(entry.recipeId)
      const { main, alt } = servingsFor(spec, recipe, Boolean(entry.altRecipeId))
      return {
        id: key,
        dayIndex: entry.dayIndex,
        date: addDays(spec.startDate, entry.dayIndex),
        slot: entry.slot,
        recipeId: entry.recipeId,
        servings: main,
        altRecipeId: entry.altRecipeId ?? undefined,
        altServings: alt,
        locked: false,
      } satisfies MenuEntry
    })
    .sort((a, b) => a.dayIndex - b.dayIndex || (a.slot === 'comida' ? -1 : 1))
}

export const recipeMap = (recipes: Recipe[]) => new Map(recipes.map((r) => [r.id, r]))

export const pruneRecipes = (recipes: Recipe[], menu: MenuEntry[]): Recipe[] => {
  const used = new Set(menu.flatMap((e) => [e.recipeId, e.altRecipeId].filter(Boolean) as string[]))
  return recipes.filter((r) => used.has(r.id))
}
