"use client";

export type TimelineNode = {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "warn";
  latency?: number;
};

const NODE_LABELS: Record<string, string> = {
  family_analyzer: "Analizando familia",
  nutrition_target: "Calculando nutrición",
  menu_planner: "Cocinando 3 propuestas",
  product_matcher: "Buscando productos",
  allergen_guard: "Verificando alérgenos",
  cost_estimator: "Calculando costes",
  coverage_guard: "Verificando cobertura",
};

function labelFor(node: string): string {
  return NODE_LABELS[node] || node.replace(/_/g, " ");
}

export default function ProgressTimeline({
  nodes,
}: {
  nodes: TimelineNode[];
}) {
  return (
    <ol className="space-y-3">
      {nodes.map((n) => (
        <li key={n.key} className="flex items-center gap-3">
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              n.status === "done"
                ? "bg-mgreen text-white"
                : n.status === "warn"
                ? "bg-mwarn text-white"
                : n.status === "running"
                ? "border-2 border-mgreen text-mgreen"
                : "border-2 border-msurface2 text-mmuted"
            }`}
          >
            {n.status === "done" ? "✓" : n.status === "warn" ? "⚠" : n.status === "running" ? "●" : "·"}
          </span>
          <span
            className={`text-sm ${
              n.status === "pending"
                ? "text-mmuted"
                : "font-semibold text-mtext"
            }`}
          >
            {n.label}
            {n.latency !== undefined && (
              <span className="ml-2 font-normal text-mmuted">
                ({(n.latency / 1000).toFixed(1)} s)
              </span>
            )}
            {n.status === "running" && (
              <span className="ml-2 animate-pulse text-mgreen">···</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function makeNode(key: string, status: TimelineNode["status"] = "pending"): TimelineNode {
  return { key, label: labelFor(key), status };
}
