import type { ChatMessage, MealSlot, MenuEntry, PlanSpec, Recipe } from '../types'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export interface HealthInfo {
  ai: boolean
  provider: string
  model: string | null
}

export type ChatAction =
  | { type: 'replace_meal'; dayIndex: number; slot: MealSlot; reason: string }
  | { type: 'update_spec'; patch: Partial<PlanSpec> }
  | { type: 'add_item'; name: string; qty: number; unit: 'g' | 'ml' | 'ud' | 'cda' | 'pizca' }
  | { type: 'regenerate_all'; reason?: string }
  | { type: 'none' }

export interface ChatResult {
  reply: string
  actions: ChatAction[]
}

export interface MenuResult {
  recipes: Recipe[]
  menu: Array<Pick<MenuEntry, 'dayIndex' | 'slot' | 'recipeId'> & { altRecipeId: string | null }>
  spec: PlanSpec
}

export class ApiUnavailable extends Error {}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiUnavailable('No hay conexión con el servicio de IA.')
  }

  if (res.status === 503) throw new ApiUnavailable('IA no configurada en el servidor.')
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ?? 'La generación ha fallado. Inténtalo otra vez.')
  }
  return res.json() as Promise<T>
}

export async function fetchHealth(): Promise<HealthInfo> {
  try {
    const res = await fetch(`${BASE}/health`)
    if (!res.ok) throw new Error()
    return (await res.json()) as HealthInfo
  } catch {
    return { ai: false, provider: 'none', model: null }
  }
}

export const requestPlan = (prompt: string, startDate: string) =>
  post<{ spec: PlanSpec }>('/plan', { prompt, startDate })

export const requestMenu = (spec: PlanSpec, avoidRecipes: string[], hint = '') =>
  post<MenuResult>('/menu', { spec, avoidRecipes, hint })

export const requestRecipe = (payload: {
  spec: PlanSpec
  slot: MealSlot
  replaces?: string
  hint?: string
  mustBeSuitableFor?: string
  avoidRecipes?: string[]
}) => post<{ recipe: Recipe }>('/recipe', payload)

export const requestChat = (message: string, spec: PlanSpec, menuSummary: string[]) =>
  post<ChatResult>('/chat', { message, spec, menuSummary })

export const toMenuSummary = (
  menu: MenuEntry[],
  recipeName: (id: string) => string,
): ChatMessage['text'][] =>
  menu.map((entry) => `Día ${entry.dayIndex + 1} ${entry.slot}: ${recipeName(entry.recipeId)}`)
