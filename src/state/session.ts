import { buildMenuLocal } from '../engine/fallback'
import { buildShoppingList } from '../engine/shopping'
import type { AppState, MenuEntry, PlanSpec, Recipe, ShoppingItem } from '../types'
import { addDays, emptySpec, recipeMap, todayISO, toMenuEntries } from './store'

const USER_KEY = 'mercaplan:user'
const HISTORY_KEY = 'mercaplan:history'

export interface User {
  name: string
  slug: string
  since: number
}

export interface OrderInfo {
  reference: string
  placedAt: number
  deliveryDate: string
  deliverySlot: string
  address: string
  items: number
  total: number
}

export interface HistoryEntry {
  id: string
  userSlug: string
  createdAt: number
  prompt: string
  spec: PlanSpec
  recipes: Recipe[]
  menu: MenuEntry[]
  shopping: ShoppingItem[]
  source: AppState['source']
  order?: OrderInfo
}

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Cuota llena o modo privado: la app sigue funcionando sin persistencia.
  }
}

export const loadUser = (): User | null => read<User | null>(USER_KEY, null)

export function saveUser(name: string): User {
  const clean = name.trim().slice(0, 40)
  const user: User = { name: clean, slug: slugify(clean) || 'invitado', since: Date.now() }
  write(USER_KEY, user)
  return user
}

export const clearUser = (): void => {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // ignorado a propósito
  }
}

export const loadHistory = (userSlug: string): HistoryEntry[] =>
  read<HistoryEntry[]>(HISTORY_KEY, [])
    .filter((entry) => entry.userSlug === userSlug)
    .sort((a, b) => b.createdAt - a.createdAt)

function writeAll(entries: HistoryEntry[]): void {
  write(HISTORY_KEY, entries.slice(0, 60))
}

export function upsertHistory(entry: HistoryEntry): HistoryEntry[] {
  const all = read<HistoryEntry[]>(HISTORY_KEY, [])
  const next = [entry, ...all.filter((e) => e.id !== entry.id)].sort(
    (a, b) => b.createdAt - a.createdAt,
  )
  writeAll(next)
  return next.filter((e) => e.userSlug === entry.userSlug)
}

export function removeHistory(id: string, userSlug: string): HistoryEntry[] {
  const next = read<HistoryEntry[]>(HISTORY_KEY, []).filter((e) => e.id !== id)
  writeAll(next)
  return next.filter((e) => e.userSlug === userSlug)
}

/** Planes de la semana pasada para que un usuario nuevo no vea el historial vacío. */
export function seedHistory(user: User): HistoryEntry[] {
  if (loadHistory(user.slug).length) return loadHistory(user.slug)

  const seeds: Array<{ daysAgo: number; prompt: string; spec: Partial<PlanSpec>; ordered: boolean }> = [
    {
      daysAgo: 7,
      prompt: 'Semana normal para los cinco, una persona vegana. Comidas y cenas.',
      spec: {
        people: [
          { id: 'p1', name: user.name, diets: [] },
          { id: 'p2', name: 'Comensal 2', diets: [] },
          { id: 'p3', name: 'Comensal 3', diets: ['vegano'] },
          { id: 'p4', name: 'Comensal 4', diets: [] },
          { id: 'p5', name: 'Comensal 5', diets: [] },
        ],
        days: 7,
        slots: ['comida', 'cena'],
      },
      ordered: true,
    },
    {
      daysAgo: 12,
      prompt: 'Solo cenas rápidas de lunes a viernes, algo ligero.',
      spec: {
        people: [
          { id: 'p1', name: user.name, diets: [] },
          { id: 'p2', name: 'Comensal 2', diets: [] },
        ],
        days: 5,
        slots: ['cena'],
        maxMinutes: 25,
      },
      ordered: false,
    },
  ]

  let history: HistoryEntry[] = []

  for (const seed of seeds) {
    const startDate = addDays(todayISO(), -seed.daysAgo)
    const spec: PlanSpec = { ...emptySpec(), ...seed.spec, startDate, notes: ['Plan del historial'] }
    const local = buildMenuLocal(spec)
    const menu = toMenuEntries(local.menu, spec, local.recipes)
    const shopping = buildShoppingList({ menu, recipes: recipeMap(local.recipes) }).map((item) => ({
      ...item,
      checked: true,
    }))
    const createdAt = new Date(`${startDate}T10:30:00`).getTime()

    const entry: HistoryEntry = {
      id: `seed-${user.slug}-${seed.daysAgo}`,
      userSlug: user.slug,
      createdAt,
      prompt: seed.prompt,
      spec,
      recipes: local.recipes,
      menu,
      shopping,
      source: 'local',
      order: seed.ordered
        ? {
            reference: `MP-${String(createdAt).slice(-6)}`,
            placedAt: createdAt + 3_600_000,
            deliveryDate: addDays(startDate, 1),
            deliverySlot: '17:00 - 19:00',
            address: 'Dirección guardada',
            items: shopping.length,
            total: Math.round(shopping.length * 2.7 * 100) / 100,
          }
        : undefined,
    }

    history = upsertHistory(entry)
  }

  return history
}
