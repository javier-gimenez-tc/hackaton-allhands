import { SECTIONS, getSection, guessSection } from '../data/sections'
import type {
  MenuEntry,
  Recipe,
  RouteStop,
  ShoppingItem,
  Unit,
} from '../types'

const CONTINUOUS: Unit[] = ['g', 'ml']

/** Redondeo a formato de compra real: nadie compra 237 g de lentejas. */
function roundQty(qty: number, unit: Unit): number {
  if (unit === 'ud') return Math.ceil(qty)
  if (unit === 'g' || unit === 'ml') {
    if (qty <= 100) return Math.ceil(qty / 25) * 25
    if (qty <= 1000) return Math.ceil(qty / 50) * 50
    return Math.ceil(qty / 100) * 100
  }
  return Math.ceil(qty * 2) / 2
}

const normalizeName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export interface BuildListOptions {
  menu: MenuEntry[]
  recipes: Map<string, Recipe>
  previous?: ShoppingItem[]
}

/**
 * Agrega los ingredientes de todo el menú escalando por comensales
 * y los agrupa por sección de tienda. Conserva los marcados y los manuales.
 */
export function buildShoppingList({ menu, recipes, previous = [] }: BuildListOptions): ShoppingItem[] {
  const acc = new Map<string, ShoppingItem>()

  const addRecipe = (recipeId: string | undefined, servings: number) => {
    if (!recipeId || servings <= 0) return
    const recipe = recipes.get(recipeId)
    if (!recipe) return

    for (const ingredient of recipe.ingredients) {
      const key = `${normalizeName(ingredient.name)}|${ingredient.unit}`
      const existing = acc.get(key)
      if (existing) {
        existing.qty += ingredient.qty * servings
        if (!existing.usedIn.includes(recipe.name)) existing.usedIn.push(recipe.name)
      } else {
        acc.set(key, {
          key,
          name: ingredient.name,
          qty: ingredient.qty * servings,
          unit: ingredient.unit,
          section: ingredient.section,
          usedIn: [recipe.name],
          checked: false,
          manual: false,
        })
      }
    }
  }

  for (const entry of menu) {
    addRecipe(entry.recipeId, entry.servings)
    addRecipe(entry.altRecipeId, entry.altServings)
  }

  const checkedBefore = new Set(previous.filter((i) => i.checked).map((i) => i.key))

  const items = [...acc.values()].map((item) => ({
    ...item,
    qty: roundQty(item.qty, item.unit),
    checked: checkedBefore.has(item.key),
  }))

  const manuals = previous.filter((i) => i.manual && !acc.has(i.key))
  return sortByRoute([...items, ...manuals])
}

export function sortByRoute(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    const diff = getSection(a.section).order - getSection(b.section).order
    return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es')
  })
}

export function createManualItem(rawName: string, qty = 1, unit: Unit = 'ud'): ShoppingItem {
  const name = rawName.trim().slice(0, 60)
  return {
    key: `manual|${normalizeName(name)}|${unit}`,
    name,
    qty,
    unit,
    section: guessSection(name),
    usedIn: ['Añadido a mano'],
    checked: false,
    manual: true,
  }
}

/** Solo paramos en las secciones que tienen algo que coger: esa es la ruta óptima. */
export function buildRoute(items: ShoppingItem[]): RouteStop[] {
  const grouped = new Map<string, ShoppingItem[]>()
  for (const item of items) {
    const list = grouped.get(item.section) ?? []
    list.push(item)
    grouped.set(item.section, list)
  }

  return SECTIONS.filter((section) => grouped.has(section.id)).map((section) => {
    const sectionItems = sortByRoute(grouped.get(section.id) ?? [])
    return {
      section,
      items: sectionItems,
      minutes: section.stopMinutes + Math.floor(sectionItems.length / 4),
    }
  })
}

export const routeMinutes = (route: RouteStop[]): number =>
  route.reduce((total, stop) => total + stop.minutes, 0) + 5

export interface ListStats {
  items: number
  checked: number
  sections: number
  estimatedCost: number
  minutes: number
}

export function listStats(
  items: ShoppingItem[],
  menu: MenuEntry[],
  recipes: Map<string, Recipe>,
): ListStats {
  const route = buildRoute(items)
  const estimatedCost = menu.reduce((total, entry) => {
    const main = recipes.get(entry.recipeId)
    const alt = entry.altRecipeId ? recipes.get(entry.altRecipeId) : undefined
    return (
      total +
      (main ? main.costPerServing * entry.servings : 0) +
      (alt ? alt.costPerServing * entry.altServings : 0)
    )
  }, 0)

  return {
    items: items.length,
    checked: items.filter((i) => i.checked).length,
    sections: route.length,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    minutes: routeMinutes(route),
  }
}

export const formatQty = (qty: number, unit: Unit): string => {
  const value = CONTINUOUS.includes(unit) ? Math.round(qty) : Math.round(qty * 10) / 10
  const label = unit === 'ud' ? (value === 1 ? 'ud' : 'uds') : unit
  return `${value} ${label}`
}
