"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import MealCard from "@/components/MealCard";
import ChatPanel from "@/components/ChatPanel";
import { ErrorBanner, Skeleton } from "@/components/States";
import { getPlan, selectPlan } from "@/lib/api";
import type { Plan, PlanDay, PlannedMeal } from "@/lib/types";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function dayLabel(date: string): string {
  const idx = new Date(date + "T00:00:00").getDay();
  return DAY_LABELS[(idx + 6) % 7];
}

export default function PlanPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"plan" | "chat">("plan");
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState(false);
  const [sessionId, setSessionId] = useState(planId);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("mh:sessionId") : null;
    if (saved) setSessionId(saved);
  }, [planId]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPlan(planId)
      .then((p) => {
        setPlan(p);
        setSelected(p.status === "selected");
      })
      .catch(() => setError("No se pudo cargar el plan."))
      .finally(() => setLoading(false));
  }, [planId]);

  useEffect(load, [load]);

  function replaceMeal(date: string, mealType: string, newMeal: PlannedMeal) {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) =>
          d.date === date
            ? { ...d, meals: d.meals.map((m) => (m.meal_type === mealType ? newMeal : m)) }
            : d
        ),
      };
    });
  }

  async function confirmMenu() {
    if (!plan) return;
    setConfirming(true);
    try {
      await selectPlan(planId, plan.variant ?? 1);
      setSelected(true);
    } catch {
      setError("No se pudo confirmar el menú.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Tu menú semanal" />
        <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-card" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Tu menú semanal" />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <ErrorBanner message={error || "Plan no encontrado."} onRetry={load} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="Tu menú semanal" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-mtext">
            Variante {plan.variant ?? 1} · Semana del {plan.days[0]?.date}
          </h1>
          <div className="flex gap-2">
            <button
              onClick={confirmMenu}
              disabled={confirming || selected}
              className="min-h-[44px] rounded-lg bg-mgreen px-4 py-2.5 text-sm font-semibold text-white hover:bg-mgreen-dark disabled:opacity-60"
            >
              {selected ? "Menú confirmado ✓" : confirming ? "Confirmando…" : "Confirmar menú"}
            </button>
            <Link
              href={`/cart/${planId}`}
              aria-disabled={!selected}
              onClick={(e) => {
                if (!selected) e.preventDefault();
              }}
              className={`inline-flex min-h-[44px] items-center rounded-lg px-4 py-2.5 text-sm font-semibold ${
                selected
                  ? "border border-mgreen text-mgreen hover:bg-mgreen hover:text-white"
                  : "pointer-events-none border border-msurface2 text-mmuted opacity-60"
              }`}
            >
              Ver lista de compra
            </Link>
            <Link
              href={`/nutrition/${planId}`}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-msurface2 px-4 py-2.5 text-sm font-semibold text-mtext hover:border-mgreen hover:text-mgreen"
            >
              Nutrición
            </Link>
          </div>
        </div>

        <div className="mb-3 flex gap-2 lg:hidden">
          <button
            onClick={() => setMobileTab("plan")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mobileTab === "plan" ? "bg-mgreen text-white" : "bg-msurface text-mtext"}`}
          >
            Calendario
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mobileTab === "chat" ? "bg-mgreen text-white" : "bg-msurface text-mtext"}`}
          >
            Chat IA
          </button>
        </div>

        <div className="flex gap-6">
          <div className={`flex-1 ${mobileTab === "chat" ? "hidden lg:block" : ""}`}>
            <div className="hidden gap-3 lg:grid lg:grid-cols-7">
              {plan.days.map((day) => (
                <div key={day.date} className="rounded-card bg-msurface p-2">
                  <p className="mb-2 text-center text-xs font-bold uppercase text-mmuted">
                    {dayLabel(day.date)}
                  </p>
                  <div className="space-y-2">
                    {day.meals.map((meal) => (
                      <MealCard
                        key={meal.meal_type}
                        meal={meal}
                        date={day.date}
                        planId={planId}
                        onRegenerated={(m) => replaceMeal(day.date, meal.meal_type, m)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 lg:hidden">
              {plan.days.map((day: PlanDay) => {
                const open = openDay === day.date;
                return (
                  <div key={day.date} className="rounded-card bg-msurface">
                    <button
                      onClick={() => setOpenDay(open ? null : day.date)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-mtext"
                      aria-expanded={open}
                    >
                      {dayLabel(day.date)} {day.date.slice(5)}
                      <span aria-hidden>{open ? "▲" : "▼"}</span>
                    </button>
                    {open && (
                      <div className="space-y-2 px-3 pb-3">
                        {day.meals.map((meal) => (
                          <MealCard
                            key={meal.meal_type}
                            meal={meal}
                            date={day.date}
                            planId={planId}
                            onRegenerated={(m) => replaceMeal(day.date, meal.meal_type, m)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="hidden w-96 shrink-0 rounded-card border border-msurface2 lg:block">
            <div className="h-[70vh]">
              <ChatPanel sessionId={sessionId} />
            </div>
          </aside>

          {mobileTab === "chat" && (
            <div className="fixed inset-x-0 bottom-14 top-40 z-30 bg-white lg:hidden">
              <ChatPanel sessionId={sessionId} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
