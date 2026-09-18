"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ProgressTimeline, { makeNode, type TimelineNode } from "@/components/ProgressTimeline";
import { SkeletonCard, ErrorBanner } from "@/components/States";
import { CoverageBadge } from "@/components/Charts";
import {
  generateMenu,
  getProfile,
  searchProducts,
  selectPlan,
  streamMenuEvents,
} from "@/lib/api";
import type { Profile, Proposal, Product } from "@/lib/types";

const VARIANT_BADGES: Record<number, string> = {
  1: "Económica",
  2: "Variada",
  3: "Rápida",
};

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [calorieMode, setCalorieMode] = useState<"auto" | "manual">("auto");
  const [macroSplit, setMacroSplit] = useState<"balanced" | "high_protein" | "low_carb">("balanced");
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [budget, setBudget] = useState(100);
  const [cookTime, setCookTime] = useState(45);
  const [notes, setNotes] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<TimelineNode[]>([]);
  const [guardAttempt, setGuardAttempt] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selecting, setSelecting] = useState<number | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setExclusions(p.excluded_products);
        setBudget(p.budget_weekly);
        setCookTime(p.max_cook_time_weekday);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchProducts(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const upsertNode = useCallback((key: string, patch: Partial<TimelineNode>) => {
    setNodes((prev) => {
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      ) as Partial<TimelineNode>;
      const idx = prev.findIndex((n) => n.key === key);
      if (idx === -1) return [...prev, { ...makeNode(key), ...clean }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...clean };
      return copy;
    });
  }, []);

  const startGeneration = useCallback(() => {
    setStep(2);
    setGenerating(true);
    setGenError(null);
    setProposals([]);
    setNodes([]);
    setGuardAttempt(0);

    (async () => {
      try {
        const res = await generateMenu({
          week_start: nextMonday(),
          constraints: {
            calorie_mode: calorieMode,
            macro_split: macroSplit,
            exclude_products: exclusions,
            budget_weekly: budget,
            max_cook_time_weekday: cookTime,
            notes,
          },
        });
        setSessionId(res.session_id);

        abortRef.current = await streamMenuEvents(res.session_id, {
          onEvent: (type, data) => {
            if (type === "node_started" && "node" in data) {
              upsertNode(data.node, { status: "running" });
            } else if (type === "node_finished" && "node" in data) {
              upsertNode(data.node, {
                status: "done",
                label: data.node === "allergen_guard" ? "Verificando alérgenos" : undefined,
                latency: "latency_ms" in data ? data.latency_ms : undefined,
              });
              if (data.node === "allergen_guard") setGuardAttempt(0);
            } else if (type === "guard_retry" && "attempt" in data) {
              setGuardAttempt(data.attempt);
              upsertNode("allergen_guard", { status: "warn" });
            } else if (type === "final" && "proposals" in data) {
              setProposals(data.proposals);
              setGenerating(false);
              setStep(3);
            } else if (type === "error" && "detail" in data) {
              setGenError(data.detail);
              setGenerating(false);
            }
          },
          onError: (err) => {
            setGenError(err.message);
            setGenerating(false);
          },
          onComplete: () => {
            setGenerating(false);
            setNodes((prev) =>
              prev.map((n) => (n.status === "running" ? { ...n, status: "done" } : n))
            );
          },
        });
      } catch {
        setGenError("No se pudo iniciar la generación. Comprueba que el backend está activo.");
        setGenerating(false);
      }
    })();
  }, [calorieMode, macroSplit, exclusions, budget, cookTime, notes, upsertNode]);

  useEffect(() => {
    return () => abortRef.current?.();
  }, []);

  const orderedNodes = useMemo(() => {
    const order = ["family_analyzer", "nutrition_target", "menu_planner", "product_matcher", "allergen_guard", "cost_estimator", "coverage_guard"];
    return [...nodes].sort((a, b) => {
      const ia = order.indexOf(a.key); const ib = order.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [nodes]);

  async function choose(proposal: Proposal) {
    setSelecting(proposal.variant);
    try {
      await selectPlan(proposal.plan_id, proposal.variant);
      if (sessionId) localStorage.setItem("mh:sessionId", sessionId);
      localStorage.setItem("mh:lastPlanId", proposal.plan_id);
      router.push(`/plan/${proposal.plan_id}`);
    } catch {
      setSelecting(null);
      setGenError("No se pudo seleccionar el menú. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header title="Menú IA · Asistente" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-mtext">Preferencias de la semana</h1>

            <fieldset className="rounded-card bg-msurface p-4">
              <legend className="px-1 text-sm font-semibold text-mtext">Calorías</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="calmode" checked={calorieMode === "auto"} onChange={() => setCalorieMode("auto")} />
                  Auto (recomendado)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="calmode" checked={calorieMode === "manual"} onChange={() => setCalorieMode("manual")} />
                  Manual
                </label>
              </div>
              {calorieMode === "manual" && (
                <p className="mt-2 text-xs text-mmuted">
                  Objetivos por miembro: se mantienen los de tu perfil familiar.
                </p>
              )}
            </fieldset>

            <fieldset className="rounded-card bg-msurface p-4">
              <legend className="px-1 text-sm font-semibold text-mtext">Estilo de macros</legend>
              <select
                value={macroSplit}
                onChange={(e) => setMacroSplit(e.target.value as typeof macroSplit)}
                className="mt-1 w-full rounded-lg border border-msurface2 bg-white px-3 py-2.5 text-sm focus:border-mgreen focus:outline-none"
              >
                <option value="balanced">Equilibrado</option>
                <option value="high_protein">Alto en proteína</option>
                <option value="low_carb">Bajo en carbos</option>
              </select>
            </fieldset>

            <fieldset className="rounded-card bg-msurface p-4">
              <legend className="px-1 text-sm font-semibold text-mtext">Productos a excluir</legend>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto…"
                className="mt-1 w-full rounded-lg border border-msurface2 bg-white px-3 py-2.5 text-sm focus:border-mgreen focus:outline-none"
              />
              {results.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-msurface2 bg-white">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          if (!exclusions.includes(p.name)) setExclusions((x) => [...x, p.name]);
                          setQuery("");
                          setResults([]);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-msurface"
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-mmuted">{p.brand}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {exclusions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {exclusions.map((x) => (
                    <span key={x} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm text-mtext border border-msurface2">
                      {x}
                      <button aria-label={`Quitar ${x}`} onClick={() => setExclusions((prev) => prev.filter((e) => e !== x))} className="text-merror font-bold">×</button>
                    </span>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="rounded-card bg-msurface p-4">
              <legend className="px-1 text-sm font-semibold text-mtext">
                Presupuesto semanal: {budget} €
              </legend>
              <input type="range" min={50} max={150} step={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-2 w-full" />
            </fieldset>

            <fieldset className="rounded-card bg-msurface p-4">
              <legend className="px-1 text-sm font-semibold text-mtext">
                Tiempo de cocina laborable: {cookTime} min
              </legend>
              <input type="range" min={20} max={60} step={5} value={cookTime} onChange={(e) => setCookTime(Number(e.target.value))} className="mt-2 w-full" />
            </fieldset>

            <fieldset className="rounded-card bg-msurface p-4">
              <legend className="px-1 text-sm font-semibold text-mtext">Notas</legend>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej: poco pescado esta semana, el miércoles comemos fuera"
                className="mt-1 w-full rounded-lg border border-msurface2 bg-white p-3 text-sm focus:border-mgreen focus:outline-none"
              />
            </fieldset>

            <button
              onClick={startGeneration}
              className="min-h-[44px] w-full rounded-lg bg-mgreen px-6 py-3 font-semibold text-white hover:bg-mgreen-dark"
            >
              Generar menú
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-mtext">Generando tu menú…</h1>
            {genError ? (
              <ErrorBanner message={genError} onRetry={startGeneration} />
            ) : (
              <>
                <div className="rounded-card bg-msurface p-4">
                  {orderedNodes.length > 0 ? (
                    <ProgressTimeline
                      nodes={orderedNodes.map((n) =>
                        n.key === "allergen_guard" && n.status === "warn"
                          ? { ...n, label: `Ajustando por alérgenos… (${guardAttempt}ª pasada)` }
                          : n
                      )}
                    />
                  ) : (
                    <p className="text-sm text-mmuted">Iniciando el equipo de agentes…</p>
                  )}
                  {generating && (
                    <p className="mt-4 text-xs text-mmuted">
                      Esto puede tardar entre 20 y 40 segundos. Estamos cocinando…
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-mtext">Elige tu menú</h1>
            {genError && <ErrorBanner message={genError} onRetry={startGeneration} />}
            {proposals.length === 0 && !genError && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}
            <div className="space-y-4">
              {proposals.map((p) => (
                <article key={p.plan_id} className="rounded-card border border-msurface2 bg-msurface p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-mtext">
                      Variante {p.variant}
                      {VARIANT_BADGES[p.variant] && (
                        <span className="ml-2 rounded-full bg-myellow/30 px-2 py-0.5 text-xs font-semibold text-mtext">
                          {VARIANT_BADGES[p.variant]}
                        </span>
                      )}
                    </h2>
                    <CoverageBadge pct={Math.round((p.summary.nutrition_coverage ?? 0) * 100)} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-mmuted">Coste</dt>
                      <dd className="font-semibold text-mtext">{p.summary.total_cost.toFixed(2)} €</dd>
                    </div>
                    <div>
                      <dt className="text-mmuted">Cobertura</dt>
                      <dd className="font-semibold text-mtext">{Math.round((p.summary.nutrition_coverage ?? 0) * 100)}%</dd>
                    </div>
                    <div>
                      <dt className="text-mmuted">Tiempo cocina</dt>
                      <dd className="font-semibold text-mtext">{p.summary.cook_time_total} min</dd>
                    </div>
                    <div>
                      <dt className="text-mmuted">Dificultad</dt>
                      <dd className="font-semibold text-mtext">{p.summary.difficulty}</dd>
                    </div>
                  </dl>
                  {p.summary.over_budget && (
                    <p className="mt-2 rounded-lg bg-mwarn/10 px-3 py-1.5 text-xs font-semibold text-mwarn">
                      ⚠ Fuera de presupuesto
                    </p>
                  )}
                  <button
                    onClick={() => choose(p)}
                    disabled={selecting !== null}
                    className="mt-4 min-h-[44px] w-full rounded-lg bg-mgreen px-4 py-2.5 font-semibold text-white hover:bg-mgreen-dark disabled:opacity-60"
                  >
                    {selecting === p.variant ? "Seleccionando…" : "Elegir esta"}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
