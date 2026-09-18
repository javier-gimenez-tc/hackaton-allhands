"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import { ErrorBanner, Skeleton } from "@/components/States";
import { MacroDonut, MacroLegend } from "@/components/Charts";
import { getRecipe } from "@/lib/api";
import type { Recipe } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  frutas: "#22864D",
  verduras: "#22864D",
  carnes: "#E5322D",
  pescados: "#2D7DD2",
  lacteos: "#F7A600",
  panaderia: "#C9954C",
  bodega: "#8C5A2B",
  congelados: "#2D9CD2",
};

function placeholderColor(category: string): string {
  const key = Object.keys(CATEGORY_COLORS).find((k) =>
    category.toLowerCase().includes(k)
  );
  return CATEGORY_COLORS[key || ""] || "#767676";
}

export default function RecipePage() {
  const params = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    getRecipe(params.id)
      .then(setRecipe)
      .catch(() => setError("No se pudo cargar la receta."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Receta" />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </main>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Receta" />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <ErrorBanner message={error || "Receta no encontrada."} onRetry={load} />
        </main>
      </div>
    );
  }

  const m = recipe.macros_per_serving;

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="Receta" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-mtext">{recipe.name}</h1>
          <p className="mt-1 text-sm text-mmuted">
            {recipe.meal_type} · {recipe.cook_time_min} min ·{" "}
            {recipe.difficulty} · {recipe.servings} raciones · {m.kcal} kcal/ración
          </p>
        </div>

        <section className="rounded-card bg-msurface p-4">
          <h2 className="mb-3 font-semibold text-mtext">Macros por ración</h2>
          <div className="flex items-center gap-6">
            <MacroDonut protein={m.protein_g} carbs={m.carbs_g} fat={m.fat_g} />
            <MacroLegend protein={m.protein_g} carbs={m.carbs_g} fat={m.fat_g} />
          </div>
        </section>

        {recipe.adaptations.length > 0 && (
          <section className="rounded-card border-2 border-mwarn bg-mwarn/10 p-4">
            <h2 className="mb-2 font-semibold text-mtext">⚠ Adaptaciones por condición</h2>
            <ul className="space-y-1 text-sm text-mtext">
              {recipe.adaptations.map((a, i) => (
                <li key={i}>
                  <strong>{a.member}:</strong> {a.swap}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-card bg-msurface p-4">
          <h2 className="mb-3 font-semibold text-mtext">Ingredientes (Hacendado)</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.product.id} className="flex items-center gap-3 rounded-lg bg-white p-3">
                <div
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                  style={{ backgroundColor: placeholderColor(ing.product.aisle) }}
                >
                  {ing.product.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-mtext">{ing.product.name}</p>
                  <p className="text-xs text-mmuted">
                    {ing.product.brand} · {ing.product.aisle}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-mtext">
                    {ing.qty} {ing.product.unit}
                  </p>
                  <p className="text-xs text-mmuted">{ing.product.price.toFixed(2)} €</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {recipe.steps.length > 0 && (
          <section className="rounded-card bg-msurface p-4">
            <h2 className="mb-3 font-semibold text-mtext">Preparación</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-mtext">
              {recipe.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
