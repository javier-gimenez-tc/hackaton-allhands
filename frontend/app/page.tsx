"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { ErrorBanner, Skeleton, SkeletonCard } from "@/components/States";
import { getProfile } from "@/lib/api";
import type { Profile } from "@/lib/types";

const CONDITION_LABELS: Record<string, string> = {
  celiac: "Celíaca",
  lactose: "Sin lactosa",
  hypertension: "Hipertensión",
  diabetic: "Diabetes",
};

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    getProfile()
      .then(setProfile)
      .catch(() => setError("No se pudo cargar el perfil. Comprueba que el backend está activo."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-white pb-20">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading && (
          <div className="rounded-card bg-msurface p-6">
            <Skeleton className="h-7 w-64 mb-4" />
            <div className="flex gap-2 mb-4">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-full" />
            </div>
            <Skeleton className="h-11 w-64 rounded-lg" />
          </div>
        )}

        {profile && (
          <section className="rounded-card bg-msurface p-6">
            <h1 className="text-xl font-bold text-mtext">
              {profile.name} <span className="text-mgreen">— configurada ✓</span>
            </h1>
            <p className="mt-1 text-sm text-mmuted">
              {profile.members.length} personas · el sistema ya conoce sus restricciones
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.members.flatMap((m) =>
                m.conditions.map((c) => (
                  <span
                    key={`${m.name}-${c.code}`}
                    className="rounded-full border border-mgreen/30 bg-white px-3 py-1.5 text-sm font-semibold text-mgreen"
                  >
                    {CONDITION_LABELS[c.code] || c.code} ({m.name})
                  </span>
                ))
              )}
              {profile.excluded_products.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-mwarn/40 bg-white px-3 py-1.5 text-sm font-semibold text-mwarn"
                >
                  Sin {p}
                </span>
              ))}
            </div>
            <Link
              href="/wizard"
              className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-mgreen px-6 py-3 font-semibold text-white hover:bg-mgreen-dark"
            >
              Crear menú de la semana
            </Link>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: "🥗", title: "Nutrición personalizada", desc: "Macros y micros ajustados a cada miembro de la familia." },
            { icon: "🛡️", title: "Alérgenos controlados", desc: "El sistema veta los alérgenos antes de proponerte nada." },
            { icon: "🛒", title: "Compra lista", desc: "Lista por pasillos con precios reales de Hacendado." },
          ].map((f) => (
            <div key={f.title} className="rounded-card bg-msurface p-4">
              <span aria-hidden className="text-2xl">{f.icon}</span>
              <h2 className="mt-2 font-semibold text-mtext">{f.title}</h2>
              <p className="mt-1 text-sm text-mmuted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold text-mtext">Planes guardados</h2>
          <p className="rounded-card bg-msurface p-4 text-sm text-mmuted">
            Aún no tienes planes. Genera tu primer menú de la semana.
          </p>
        </section>
      </main>
    </div>
  );
}
