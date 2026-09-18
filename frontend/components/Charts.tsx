export function MacroDonut({
  protein,
  carbs,
  fat,
  size = 120,
}: {
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
}) {
  const total = Math.max(protein + carbs + fat, 1);
  const segments = [
    { value: protein, color: "#22864D", label: "Proteína" },
    { value: carbs, color: "#F7A600", label: "Carbohidratos" },
    { value: fat, color: "#767676", label: "Grasas" },
  ];
  const stroke = size * 0.14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Distribución de macros"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#F0F0F0"
        strokeWidth={stroke}
      />
      {segments.map((seg) => {
        const frac = seg.value / total;
        const dash = frac * circumference;
        const el = (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

export function RingProgress({
  pct,
  size = 120,
  label,
  sub,
}: {
  pct: number;
  size?: number;
  label: string;
  sub?: string;
}) {
  const stroke = size * 0.14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const dash = (clamped / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F0F0F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#22864D"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-bold text-mtext">{label}</p>
        {sub && <p className="text-xs text-mmuted">{sub}</p>}
      </div>
    </div>
  );
}

export function MacroLegend({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const items = [
    { label: "Proteína", value: protein, color: "#22864D" },
    { label: "Carbohidratos", value: carbs, color: "#F7A600" },
    { label: "Grasas", value: fat, color: "#767676" },
  ];
  return (
    <ul className="space-y-1 text-sm text-mmuted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: i.color }}
          />
          {i.label}: {i.value} g
        </li>
      ))}
    </ul>
  );
}

export function CoverageBar({
  label,
  pct,
}: {
  label: string;
  pct: number;
}) {
  const color = pct >= 90 ? "#22864D" : pct >= 75 ? "#F7A600" : "#E5322D";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-mtext">{label}</span>
        <span className="font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-msurface2">
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function CoverageBadge({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#22864D" : pct >= 75 ? "#F7A600" : "#E5322D";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {pct}%
    </span>
  );
}
