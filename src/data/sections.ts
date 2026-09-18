import type { Section, SectionId } from '../types'

/**
 * Orden de recorrido de una tienda Mercadona tipo (entrada → línea de cajas).
 * Es el dato que convierte una lista de la compra en una ruta sin marcha atrás.
 */
export const SECTIONS: Section[] = [
  { id: 'frutas_verduras', name: 'Frutas y Verduras', order: 1, aisle: 'Entrada', icon: '🥬', stopMinutes: 6 },
  { id: 'panaderia', name: 'Panadería y Horno', order: 2, aisle: 'Pasillo 1', icon: '🥖', stopMinutes: 3 },
  { id: 'carniceria', name: 'Carnicería', order: 3, aisle: 'Mostrador A', icon: '🥩', stopMinutes: 5 },
  { id: 'pescaderia', name: 'Pescadería', order: 4, aisle: 'Mostrador B', icon: '🐟', stopMinutes: 5 },
  { id: 'charcuteria', name: 'Charcutería y Quesos', order: 5, aisle: 'Mostrador C', icon: '🧀', stopMinutes: 4 },
  { id: 'huevos_lacteos', name: 'Huevos, Leche y Yogures', order: 6, aisle: 'Pasillo 3', icon: '🥚', stopMinutes: 3 },
  { id: 'refrigerados_veg', name: 'Refrigerados Vegetales', order: 7, aisle: 'Pasillo 4', icon: '🌱', stopMinutes: 3 },
  { id: 'congelados', name: 'Congelados', order: 8, aisle: 'Pasillo 5', icon: '🧊', stopMinutes: 4 },
  { id: 'despensa', name: 'Arroz, Pasta y Legumbres', order: 9, aisle: 'Pasillo 7', icon: '🍚', stopMinutes: 3 },
  { id: 'conservas', name: 'Conservas y Caldos', order: 10, aisle: 'Pasillo 8', icon: '🥫', stopMinutes: 3 },
  { id: 'aceite_especias', name: 'Aceite, Especias y Salsas', order: 11, aisle: 'Pasillo 9', icon: '🫒', stopMinutes: 3 },
  { id: 'desayuno_dulce', name: 'Desayuno y Dulce', order: 12, aisle: 'Pasillo 10', icon: '☕', stopMinutes: 2 },
  { id: 'bebidas', name: 'Bebidas', order: 13, aisle: 'Pasillo 12', icon: '🧃', stopMinutes: 2 },
  { id: 'drogueria', name: 'Droguería', order: 14, aisle: 'Pasillo 14', icon: '🧴', stopMinutes: 2 },
]

const BY_ID = new Map<SectionId, Section>(SECTIONS.map((s) => [s.id, s]))

export function getSection(id: SectionId): Section {
  const section = BY_ID.get(id)
  if (!section) throw new Error(`Sección desconocida: ${id}`)
  return section
}

/** Palabras clave → sección, para los productos que el usuario añade a mano. */
const KEYWORDS: Array<[SectionId, string[]]> = [
  ['frutas_verduras', ['manzana', 'plátano', 'platano', 'naranja', 'lechuga', 'tomate', 'cebolla', 'ajo', 'patata', 'pimiento', 'zanahoria', 'calabacín', 'calabacin', 'aguacate', 'limón', 'limon', 'fruta', 'verdura', 'champiñ', 'espinaca', 'brócoli', 'brocoli', 'pepino', 'fresa']],
  ['panaderia', ['pan', 'baguette', 'chapata', 'croissant', 'bollo', 'tortilla de trigo', 'wrap']],
  ['carniceria', ['pollo', 'ternera', 'cerdo', 'pavo', 'carne', 'chuleta', 'solomillo', 'bacon', 'hamburguesa']],
  ['pescaderia', ['merluza', 'salmón', 'salmon', 'bacalao', 'gamba', 'pescado', 'atún fresco', 'mejillón', 'mejillon', 'calamar']],
  ['charcuteria', ['jamón', 'jamon', 'queso', 'chorizo', 'salchichón', 'salchichon', 'fiambre', 'lonchas']],
  ['huevos_lacteos', ['huevo', 'leche', 'yogur', 'nata', 'mantequilla', 'kéfir', 'kefir']],
  ['refrigerados_veg', ['tofu', 'seitán', 'seitan', 'tempeh', 'hummus', 'bebida de soja', 'yogur vegetal', 'heura', 'soja texturizada']],
  ['congelados', ['congelad', 'guisantes', 'helado', 'pizza', 'verdura para wok']],
  ['despensa', ['arroz', 'pasta', 'espagueti', 'macarr', 'lenteja', 'garbanzo', 'alubia', 'quinoa', 'cuscús', 'cuscus', 'harina', 'fideo']],
  ['conservas', ['atún', 'atun', 'tomate frito', 'tomate triturado', 'caldo', 'maíz', 'maiz', 'aceituna', 'conserva', 'leche de coco']],
  ['aceite_especias', ['aceite', 'vinagre', 'sal', 'pimienta', 'pimentón', 'pimenton', 'comino', 'curry', 'orégano', 'oregano', 'salsa', 'soja', 'especia']],
  ['desayuno_dulce', ['café', 'cafe', 'cacao', 'cereal', 'galleta', 'azúcar', 'azucar', 'miel', 'chocolate', 'mermelada', 'nuez', 'nueces', 'almendra']],
  ['bebidas', ['agua', 'refresco', 'zumo', 'cerveza', 'vino']],
  ['drogueria', ['papel', 'detergente', 'jabón', 'jabon', 'bolsa', 'limpia']],
]

export function guessSection(productName: string): SectionId {
  const name = productName.toLowerCase()
  for (const [section, words] of KEYWORDS) {
    if (words.some((w) => name.includes(w))) return section
  }
  return 'despensa'
}
