import { SEED_RECIPES } from '../data/recipes'
import type { DietTag, MealSlot, Person, PlanSpec, Recipe } from '../types'

/** Motor local: se usa cuando la IA no está disponible, para que la demo nunca se quede en blanco. */

const WORD_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
}

const toNumber = (token: string): number | null => {
  const parsed = Number(token)
  if (Number.isFinite(parsed)) return parsed
  return WORD_NUMBERS[token.toLowerCase()] ?? null
}

const DIET_PATTERNS: Array<[RegExp, DietTag]> = [
  [/vegan[oa]s?/, 'vegano'],
  [/vegetarian[oa]s?/, 'vegetariano'],
  [/sin gluten|celiac[oa]s?/, 'sin_gluten'],
  [/sin lactosa|intoleranted? a la lactosa|sin lácteos|sin lacteos/, 'sin_lactosa'],
  [/sin pescado|no come pescado|odia el pescado/, 'sin_pescado'],
  [/sin frutos secos|alergia a los frutos secos/, 'sin_frutos_secos'],
]

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'mi[ée]rcoles', 'jueves', 'viernes', 's[áa]bado']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const iso = (d: Date) => d.toISOString().slice(0, 10)
const plus = (base: Date, days: number) => new Date(base.getTime() + days * 86_400_000)

/** Traduce expresiones tipo "la semana que viene" o "a partir del jueves" a una fecha ISO. */
function parseStartDate(text: string, today = new Date()): string {
  if (/pasado mañana/.test(text)) return iso(plus(today, 2))
  if (/\bmañana\b/.test(text)) return iso(plus(today, 1))

  const nextWeek = /(semana que viene|pr[oó]xima semana|semana pr[oó]xima)/.test(text)

  const dayName = WEEKDAYS.findIndex((name) => new RegExp(`\\b${name}`).test(text))
  if (dayName >= 0) {
    let delta = (dayName - today.getDay() + 7) % 7
    if (nextWeek && delta === 0) delta = 7
    return iso(plus(today, delta))
  }

  if (nextWeek) {
    const toMonday = ((8 - today.getDay()) % 7) || 7
    return iso(plus(today, toMonday))
  }

  if (/fin de semana/.test(text)) return iso(plus(today, (6 - today.getDay() + 7) % 7))

  const dated = text.match(/\b(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)?/)
  const monthName = dated?.[2] ? MONTHS.findIndex((m) => m.startsWith(dated[2].slice(0, 4))) : -1
  if (dated && monthName >= 0) {
    const day = Number(dated[1])
    const year = today.getFullYear() + (monthName < today.getMonth() ? 1 : 0)
    const candidate = new Date(year, monthName, day)
    if (!Number.isNaN(candidate.getTime())) return iso(candidate)
  }

  return iso(today)
}

export function parsePromptLocal(prompt: string): PlanSpec {
  const text = prompt.toLowerCase()

  const peopleMatch =
    text.match(/somos\s+(\w+)/) ??
    text.match(/(\w+)\s+personas/) ??
    text.match(/(\w+)\s+comensales/) ??
    text.match(/para\s+(\w+)\b/)
  const total = Math.min(12, Math.max(1, toNumber(peopleMatch?.[1] ?? '') ?? 4))

  let days = 7
  if (/fin de semana/.test(text)) days = 2
  const daysMatch = text.match(/(\w+)\s+d[ií]as?/)
  if (daysMatch) days = Math.min(14, Math.max(1, toNumber(daysMatch[1]) ?? 7))
  if (/quincena|dos semanas/.test(text)) days = 14

  const slots: MealSlot[] =
    /solo cenas?|s[oó]lo cenas?|únicamente cenas?/.test(text)
      ? ['cena']
      : /solo comidas?|s[oó]lo comidas?/.test(text)
        ? ['comida']
        : ['comida', 'cena']

  const notes: string[] = []
  const people: Person[] = Array.from({ length: total }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Comensal ${i + 1}`,
    diets: [],
  }))

  for (const [pattern, tag] of DIET_PATTERNS) {
    const match = text.match(new RegExp(`(\\w+)\\s+(?:persona[s]?\\s+(?:es|son)\\s+)?${pattern.source}`))
    if (!pattern.test(text)) continue
    const affected = Math.min(total, toNumber(match?.[1] ?? '') ?? total)
    for (let i = 0; i < affected; i += 1) {
      if (!people[i].diets.includes(tag)) people[i].diets.push(tag)
    }
    notes.push(affected === total ? `Todo el menú ${tag.replace('_', ' ')}` : `${affected} comensal(es) ${tag.replace('_', ' ')}`)
  }

  const budgetMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros)/)
  const timeMatch = text.match(/(\d+)\s*(?:min|minutos)/)

  return {
    people,
    days,
    startDate: parseStartDate(text),
    slots,
    maxMinutes: timeMatch ? Number(timeMatch[1]) : 45,
    budgetPerPersonDay: budgetMatch ? Number(budgetMatch[1].replace(',', '.')) : undefined,
    excluded: [],
    notes: notes.length ? notes : ['Plan generado con el motor local'],
  }
}

export const requiredTags = (people: Person[]): DietTag[] => [
  ...new Set(people.flatMap((p) => p.diets)),
]

export const isSuitable = (recipe: Recipe, diets: DietTag[]): boolean =>
  diets.every((diet) => recipe.tags.includes(diet))

export const suitsEveryone = (recipe: Recipe, people: Person[]): boolean =>
  people.every((person) => isSuitable(recipe, person.diets))

const scoreRecipe = (recipe: Recipe, spec: PlanSpec, slot: MealSlot, used: Set<string>): number => {
  let score = 0
  if (used.has(recipe.id)) score -= 100
  if (!recipe.slots.includes(slot)) score -= 25
  if (recipe.minutes > spec.maxMinutes) score -= 20
  if (spec.budgetPerPersonDay && recipe.costPerServing > spec.budgetPerPersonDay / spec.slots.length) score -= 10
  if (spec.excluded.some((bad) => recipe.ingredients.some((i) => i.name.toLowerCase().includes(bad)))) score -= 200
  if (suitsEveryone(recipe, spec.people)) score += 15
  return score + Math.random() * 3
}

const bestRecipe = (
  candidates: Recipe[],
  spec: PlanSpec,
  slot: MealSlot,
  used: Set<string>,
): Recipe | undefined =>
  [...candidates].sort((a, b) => scoreRecipe(b, spec, slot, used) - scoreRecipe(a, spec, slot, used))[0]

export interface LocalMenuResult {
  recipes: Recipe[]
  menu: Array<{ dayIndex: number; slot: MealSlot; recipeId: string; altRecipeId: string | null }>
}

export function buildMenuLocal(spec: PlanSpec): LocalMenuResult {
  const used = new Set<string>()
  const picked = new Map<string, Recipe>()
  const menu: LocalMenuResult['menu'] = []
  const restricted = requiredTags(spec.people)

  for (let dayIndex = 0; dayIndex < spec.days; dayIndex += 1) {
    for (const slot of spec.slots) {
      const main = bestRecipe(SEED_RECIPES, spec, slot, used)
      if (!main) continue
      used.add(main.id)
      picked.set(main.id, main)

      let altId: string | null = null
      if (restricted.length && !suitsEveryone(main, spec.people)) {
        const alt = bestRecipe(
          SEED_RECIPES.filter((r) => r.id !== main.id && isSuitable(r, restricted)),
          spec,
          slot,
          used,
        )
        if (alt) {
          altId = alt.id
          picked.set(alt.id, alt)
        }
      }

      menu.push({ dayIndex, slot, recipeId: main.id, altRecipeId: altId })
    }
  }

  return { recipes: [...picked.values()], menu }
}

export function pickReplacementLocal(
  spec: PlanSpec,
  slot: MealSlot,
  usedIds: string[],
  mustSuit: DietTag[] = [],
): Recipe | undefined {
  const used = new Set(usedIds)
  const pool = mustSuit.length ? SEED_RECIPES.filter((r) => isSuitable(r, mustSuit)) : SEED_RECIPES
  return bestRecipe(pool, spec, slot, used)
}
