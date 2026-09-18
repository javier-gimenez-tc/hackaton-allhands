"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import { ErrorBanner, Skeleton } from "@/components/States";
import { RingProgress, CoverageBar } from "@/components/Charts";
import { getNutritionSummary } from "@/lib/api";
import type { NutritionSummary } from "@/lib/types";

const NUTRIENT_LABELS: Record<string, string> = {
  calcium: "Calcio",
  vitamin_d: "Vitamina D",
  fiber: "Fibra",
  sodium: "Sodio",
  iron: "Hierro",
  potassium: "Potasio",
};

export default function NutritionPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    getNutritionSummary(planId)
      .then(setSummary)
      .catch(() => setError("No se pudo cargar el resumen nutricional."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [planId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Resumen nutricional" />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </main>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Resumen nutricional" />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <ErrorBanner message={error || "Resumen no disponible."} onRetry={load} />
        </main>
      </div>
    );
  }

  const fam = summary.family_daily_avg;
  const kcalPct = fam.target_kcal > 0 ? Math.round((fam.kcal / fam.target_kcal) * 100) : 0;

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="Resumen nutricional" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-mtext">Nutrición de la semana</h1>
          <Link href={`/plan/${planId}`} className="text-sm font-semibold text-mgreen hover:underline">
            ← Volver al menú
          </Link>
        </div>

        <section className="rounded-card bg-msurface p-4">
          <h2 className="mb-3 font-semibold text-mtext">Media familiar diaria</h2>
          <div className="flex items-center gap-6">
            <RingProgress
              pct={kcalPct}
              label={`${kcalPct}%`}
              sub={`${fam.kcal.toLocaleString("es-ES")} / ${fam.target_kcal.toLocaleString("es-ES")} kcal`}
            />
            <p className="text-sm text-mmuted">
              Media diaria de la familia frente al objetivo calórico calculado para cada miembro.
            </p>
          </div>
        </section>

        {summary.by_member.map((member) => (
          <section key={member.name} className="rounded-card bg-msurface p-4">
            <h2 className="mb-3 font-semibold text-mtext">{member.name}</h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="text-sm sm:w-40">
                <p className="font-semibold text-mtext">
                  {member.macros.protein_g} g proteína
                </p>
                <p className="text-mmuted">Objetivo: {member.macros.target_g} g</p>
              </div>
              <div className="flex-1 space-y-2">
                <CoverageBar
                  label="Proteína"
                  pct={member.macros.target_g > 0 ? Math.round((member.macros.protein_g / member.macros.target_g) * 100) : 0}
                />
                {member.micros_flags.map((mf) => (
                  <CoverageBar
                    key={mf.nutrient}
                    label={NUTRIENT_LABELS[mf.nutrient] || mf.nutrient}
                    pct={Math.round(mf.coverage_pct)}
                  />
                ))}
                {member.micros_flags.length === 0 && (
                  <p className="flex items-center gap-2 text-sm text-mgreen">
                    <span aria-hidden>✓</span> Micronutrientes cubiertos
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-card border border-mwarn/40 bg-mwarn/10 p-4">
          <h2 className="mb-2 font-semibold text-mtext">Alertas</h2>
          {summary.alerts.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-mgreen">
              <span aria-hidden>✓</span> Sin alertas esta semana
            </p>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-mtext">
              {summary.alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
