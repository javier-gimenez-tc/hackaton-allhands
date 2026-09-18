import Link from "next/link";
import BottomNav from "./BottomNav";

export default function Header({
  title = "Mercadona · Menú IA",
  showNav = true,
}: {
  title?: string;
  showNav?: boolean;
}) {
  return (
    <header className="bg-mgreen text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold"
          >
            M
          </span>
          {title}
        </Link>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          demo hackathon
        </span>
      </div>
      {showNav && <BottomNav />}
    </header>
  );
}
