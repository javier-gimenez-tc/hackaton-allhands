"use client";

import { useState } from "react";
import Link from "next/link";
import { regenerateMeal } from "@/lib/api";
import type { PlannedMeal } from "@/lib/types";

export default function MealCard({
  meal,
  date,
  planId,
  onRegenerated,
}: {
  meal: PlannedMeal;
  date: string;
  planId: string;
  onRegenerated: (meal: PlannedMeal) => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinGluten = meal.adaptations.some((a) =>
    a.swap.toLowerCase().includes("sin gluten")
  );
  const sinLactosa = meal.adaptations.some((a) =>
    a.swap.toLowerCase().includes("sin lactosa")
  );

  async function handleRegenerate() {
    setLoading(true);
    setError(null);
    try {
      const newMeal = await regenerateMeal(planId, date, meal.meal_type, feedback);
      onRegenerated(newMeal);
      setOpen(false);
      setFeedback("");
    } catch {
      setError("No se pudo regenerar la comida. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card bg-msurface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-mmuted">
            {meal.meal_type}
          </p>
          <Link
            href={`/recipe/${meal.recipe_id}`}
            className="block truncate text-sm font-semibold text-mtext hover:text-mgreen hover:underline"
          >
            {meal.name}
          </Link>
          <p className="text-xs text-mmuted">{meal.kcal} kcal</p>
        </div>
        <button
          aria-label={`Regenerar ${meal.meal_type}`}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-msurface2 bg-white text-mgreen hover:bg-mgreen hover:text-white"
        >
          ↻
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {sinGluten && (
          <span className="rounded-full bg-mgreen/10 px-2 py-0.5 text-[10px] font-bold text-mgreen">
            SG
          </span>
        )}
        {sinLactosa && (
          <span className="rounded-full bg-mgreen/10 px-2 py-0.5 text-[10px] font-bold text-mgreen">
            SL
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-msurface2 bg-white p-3">
          <label className="mb-1 block text-xs font-semibold text-mtext">
            ¿Algo que prefieras? (opcional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Ej: sin pescado y rápido"
            className="w-full rounded-lg border border-msurface2 p-2 text-sm focus:border-mgreen focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-merror">{error}</p>}
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-mgreen px-3 py-2 text-sm font-semibold text-white hover:bg-mgreen-dark disabled:opacity-60"
          >
            {loading ? "Regenerando…" : "Regenerar comida"}
          </button>
        </div>
      )}
    </div>
  );
}
