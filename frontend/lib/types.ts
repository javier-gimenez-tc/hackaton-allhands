export interface Condition {
  code: string;
  severity?: string;
  forbidden_allergens: string[];
}

export interface Member {
  id?: string;
  name: string;
  age: number;
  sex?: string;
  goals?: string[];
  conditions: Condition[];
}

export interface Profile {
  id: string;
  name: string;
  members: Member[];
  excluded_products: string[];
  budget_weekly: number;
  max_cook_time_weekday: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  aisle: string;
  price: number;
  unit: string;
  allergens: string[];
  tags: string[];
}

export interface Constraints {
  calorie_mode: "auto" | "manual";
  macro_split: "balanced" | "high_protein" | "low_carb";
  exclude_products: string[];
  budget_weekly: number;
  max_cook_time_weekday: number;
  notes: string;
}

export interface GenerateRequest {
  week_start: string;
  constraints: Constraints;
}

export interface GenerateResponse {
  session_id: string;
  status: string;
}

export interface Adaptation {
  member: string;
  swap: string;
}

export interface Coverage {
  kcal_pct: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
}

export interface PlannedMeal {
  meal_type: string;
  recipe_id: string;
  name: string;
  kcal: number;
  coverage: Coverage;
  adaptations: Adaptation[];
}

export interface PlanDay {
  date: string;
  meals: PlannedMeal[];
}

export interface PlanSummary {
  total_cost: number;
  nutrition_coverage: number;
  cook_time_total: number;
  over_budget?: boolean;
  difficulty: string;
}

export interface Plan {
  plan_id?: string;
  id?: string;
  variant?: number;
  status: string;
  summary: PlanSummary;
  days: PlanDay[];
}

export interface Proposal {
  plan_id: string;
  variant: number;
  summary: PlanSummary;
  days: PlanDay[];
}

export interface FinalEvent {
  proposals: Proposal[];
}

export interface RecipeIngredient {
  product: {
    id: string;
    name: string;
    brand: string;
    aisle: string;
    price: number;
    unit: string;
  };
  qty: number;
}

export interface Recipe {
  id: string;
  name: string;
  meal_type: string;
  servings: number;
  cook_time_min: number;
  difficulty: string;
  steps: string[];
  ingredients: RecipeIngredient[];
  macros_per_serving: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  adaptations: Adaptation[];
}

export interface CartItem {
  product_id: string;
  name: string;
  aisle: string;
  qty: number;
  unit: string;
  est_price: number;
  done: boolean;
}

export interface Cart {
  items: CartItem[];
  total: number;
  by_aisle: Record<string, { items: CartItem[]; subtotal: number }>;
}

export interface OptimizeResult {
  route_groups: number;
  estimated_picking_min: number;
  delivery_slot: string;
  items_count: number;
  total: number;
}

export interface NutritionSummary {
  by_member: {
    name: string;
    macros: { protein_g: number; target_g: number };
    micros_flags: { nutrient: string; coverage_pct: number }[];
  }[];
  family_daily_avg: { kcal: number; target_kcal: number };
  alerts: string[];
}

export interface SelectResponse {
  status: string;
}
