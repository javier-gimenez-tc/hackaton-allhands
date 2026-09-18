"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import { ErrorBanner, Skeleton } from "@/components/States";
import { getCart, optimizeCart } from "@/lib/api";
import type { Cart, OptimizeResult } from "@/lib/types";

export default function CartPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null);
  const [optError, setOptError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getCart(planId)
      .then(setCart)
      .catch(() => setError("No se pudo cargar la lista de compra."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [planId]);

  async function handleOptimize() {
    setOptimizing(true);
    setOptError(null);
    try {
      const res = await optimizeCart(planId);
      setOptResult(res);
    } catch {
      setOptError("No se pudo optimizar el envío. Inténtalo de nuevo.");
    } finally {
      setOptimizing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Lista de compra" />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 rounded-card" />
        </main>
      </div>
    );
  }

  if (error || !cart) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <Header title="Lista de compra" />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <ErrorBanner message={error || "Lista no encontrada."} onRetry={load} />
        </main>
      </div>
    );
  }

  const aisles = Object.entries(cart.by_aisle);

  return (
    <div className="min-h-screen bg-white pb-32">
      <Header title="Lista de compra" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-mtext">Tu compra semanal</h1>
          <Link href={`/plan/${planId}`} className="text-sm font-semibold text-mgreen hover:underline">
            ← Volver al menú
          </Link>
        </div>

        {aisles.length === 0 && (
          <p className="rounded-card bg-msurface p-4 text-sm text-mmuted">
            La lista de compra está vacía.
          </p>
        )}

        {aisles.map(([aisle, group]) => (
          <section key={aisle} className="overflow-hidden rounded-card">
            <h2 className="bg-mgreen px-4 py-2.5 font-semibold text-white">{aisle}</h2>
            <ul className="divide-y divide-msurface2 border border-t-0 border-msurface2 bg-white">
              {group.items.map((item) => {
                const checked = done[item.product_id] ?? item.done;
                return (
                  <li key={item.product_id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setDone((d) => ({ ...d, [item.product_id]: e.target.checked }))
                      }
                      className="h-5 w-5 accent-[#22864D]"
                      aria-label={`Marcar ${item.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${checked ? "text-mmuted line-through" : "text-mtext"}`}>
                        {item.name}
                      </p>
                      <p className="text-xs text-mmuted">
                        {item.qty} {item.unit}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-mtext">
                      {item.est_price.toFixed(2)} €
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="bg-msurface px-4 py-2 text-right text-xs font-semibold text-mmuted">
              Subtotal: {group.subtotal.toFixed(2)} €
            </p>
          </section>
        ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-msurface2 bg-white p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-xs text-mmuted">Total estimado</p>
            <p className="text-xl font-bold text-mtext">{cart.total.toFixed(2)} €</p>
          </div>
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="min-h-[44px] rounded-lg bg-mgreen px-6 py-3 font-semibold text-white hover:bg-mgreen-dark disabled:opacity-60"
          >
            {optimizing ? "Optimizando…" : "Optimizar envío"}
          </button>
        </div>
        {optError && <p className="mx-auto mt-2 max-w-3xl text-sm text-merror">{optError}</p>}
      </div>

      {optResult && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOptResult(null)}
        >
          <div
            className="w-full max-w-md rounded-card bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-mtext">Envío optimizado ✓</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-mmuted">Grupos de ruta</dt>
                <dd className="font-semibold text-mtext">{optResult.route_groups}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mmuted">Picking estimado</dt>
                <dd className="font-semibold text-mtext">{optResult.estimated_picking_min} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mmuted">Franja de entrega</dt>
                <dd className="font-semibold text-mtext">{optResult.delivery_slot}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mmuted">Unidades</dt>
                <dd className="font-semibold text-mtext">{optResult.items_count}</dd>
              </div>
              <div className="flex justify-between border-t border-msurface2 pt-2">
                <dt className="text-mmuted">Total</dt>
                <dd className="font-bold text-mgreen">{optResult.total.toFixed(2)} €</dd>
              </div>
            </dl>
            <button
              onClick={() => setOptResult(null)}
              className="mt-6 min-h-[44px] w-full rounded-lg bg-mgreen px-4 py-2.5 font-semibold text-white hover:bg-mgreen-dark"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
