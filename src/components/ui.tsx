import Link from "next/link";
import type { Sector } from "@/lib/ctx";

export function Page({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h1">{title}</h1>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectorPicker({ sectors, current, base, extra = "" }: { sectors: Sector[]; current: string; base: string; extra?: string }) {
  if (sectors.length < 2) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {sectors.map((s) => (
        <Link key={s.id} href={`${base}?s=${s.id}${extra}`} className={`chip shrink-0 ${s.id === current ? "chip-on" : ""}`}>
          {s.name}
        </Link>
      ))}
    </div>
  );
}

// Filtro de setor: "Todos" + um botão por setor. Só filtra, não define nada.
export function SectorFilter({ sectors, current, base, params = "", counts }: { sectors: Sector[]; current?: string | null; base: string; params?: string; counts?: { all: number; by: Map<string, number> } }) {
  if (sectors.length < 2) return null;
  const q = (extra: string) => `${base}?${[extra, params].filter(Boolean).join("&")}`.replace(/\?$/, "");
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Filtrar por setor">
      <Link href={q("")} className={`chip shrink-0 ${!current ? "chip-on" : ""}`}>
        Todos{counts && <span className="ml-1.5 opacity-70">{counts.all}</span>}
      </Link>
      {sectors.map((s) => (
        <Link key={s.id} href={q(`s=${s.id}`)} className={`chip shrink-0 ${current === s.id ? "chip-on" : ""}`}>
          {s.name}{counts && <span className="ml-1.5 opacity-70">{counts.by.get(s.id) ?? 0}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card muted text-center">{children}</div>;
}

export function Flash({ msg, tone = "error" }: { msg?: string; tone?: "error" | "ok" }) {
  if (!msg) return null;
  const c = tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700";
  return <p className={`rounded-xl px-3 py-2 text-sm ${c}`}>{msg}</p>;
}
