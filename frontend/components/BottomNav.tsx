"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/wizard", label: "Menú", icon: "📋" },
  { href: "/cart", label: "Compra", icon: "🛒", dynamic: true },
  { href: "/", label: "Perfil", icon: "👤", hash: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [lastPlan, setLastPlan] = useState<string | null>(null);

  useEffect(() => {
    setLastPlan(localStorage.getItem("mh:lastPlanId"));
  }, [pathname]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-msurface2 bg-white lg:hidden">
      {items.map((item) => {
        const base = item.href.replace("-index", "");
        const active =
          item.label === "Inicio" || item.label === "Perfil"
            ? pathname === "/" && !item.hash
            : pathname.startsWith(base);
        const href =
          item.label === "Perfil"
            ? "/#perfil"
            : item.dynamic
            ? lastPlan
              ? `/cart/${lastPlan}`
              : "/wizard"
            : item.href;
        return (
          <Link
            key={item.label}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs min-h-[44px] justify-center ${
              active ? "text-mgreen font-semibold" : "text-mmuted"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
