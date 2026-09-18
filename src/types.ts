export type DietTag =
  | 'vegano'
  | 'vegetariano'
  | 'sin_gluten'
  | 'sin_lactosa'
  | 'sin_pescado'
  | 'sin_frutos_secos'

export type MealSlot = 'comida' | 'cena'

export type Unit = 'g' | 'ml' | 'ud' | 'cda' | 'pizca'

export type SectionId =
  | 'frutas_verduras'
  | 'panaderia'
  | 'carniceria'
  | 'pescaderia'
  | 'charcuteria'
  | 'huevos_lacteos'
  | 'refrigerados_veg'
  | 'congelados'
  | 'despensa'
  | 'conservas'
  | 'aceite_especias'
  | 'desayuno_dulce'
  | 'bebidas'
  | 'drogueria'

export interface Section {
  id: SectionId
  name: string
  /** Orden real del recorrido en una tienda Mercadona tipo. */
  order: number
  aisle: string
  icon: string
  /** Minutos estimados de parada media en la sección. */
  stopMinutes: number
}

export interface Ingredient {
  name: string
  /** Cantidad POR RACIÓN. El motor escala según comensales. */
  qty: number
  unit: Unit
  section: SectionId
}

export interface Recipe {
  id: string
  name: string
  minutes: number
  kcal: number
  costPerServing: number
  tags: DietTag[]
  slots: MealSlot[]
  ingredients: Ingredient[]
  steps: string[]
}

export interface Person {
  id: string
  name: string
  diets: DietTag[]
}

export interface PlanSpec {
  people: Person[]
  days: number
  startDate: string
  slots: MealSlot[]
  maxMinutes: number
  budgetPerPersonDay?: number
  excluded: string[]
  notes: string[]
}

export interface MenuEntry {
  id: string
  dayIndex: number
  date: string
  slot: MealSlot
  recipeId: string
  servings: number
  /** Receta alternativa para los comensales con dieta incompatible. */
  altRecipeId?: string
  altServings: number
  locked: boolean
}

export interface ShoppingItem {
  key: string
  name: string
  qty: number
  unit: Unit
  section: SectionId
  usedIn: string[]
  checked: boolean
  manual: boolean
}

export interface RouteStop {
  section: Section
  items: ShoppingItem[]
  minutes: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'app'
  text: string
  at: number
}

export interface AppState {
  version: number
  historyId: string | null
  prompt: string
  spec: PlanSpec
  recipes: Recipe[]
  menu: MenuEntry[]
  shopping: ShoppingItem[]
  chat: ChatMessage[]
  generatedAt: number | null
  source: 'ai' | 'local' | null
}
