import Link from "next/link";
import { getCtx } from "@/lib/ctx";
import Nav, { type NavItem } from "@/components/Nav";
import { ROLE_LABEL } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  let items: NavItem[];
  if (ctx.isDp) {
    const { count } = await ctx.sb
      .from("extra_requests").select("id", { count: "exact", head: true })
      .eq("house_id", ctx.house.id).eq("status", "pending");
    items = [
      { href: "/pendencias", label: "Pendências", icon: "check", badge: count ?? 0 },
      { href: "/escala", label: "Escalas", icon: "grid" },
      { href: "/extras", label: "Extras", icon: "plus" },
      { href: "/checklist", label: "Checklist", icon: "star" },
      { href: "/equipe", label: "Equipe", icon: "people" },
      { href: "/config", label: "Config.", icon: "gear" },
    ];
  } else {
    items = [
      { href: "/escala", label: "Escala", icon: "grid" },
      { href: "/extras", label: "Extras", icon: "plus" },
      { href: "/checklist", label: "Checklist", icon: "star" },
      { href: "/equipe", label: "Equipe", icon: "people" },
    ];
  }
  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-ink px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <div className="min-w-0">
          <div className="truncate font-display text-xl font-bold leading-tight">{ctx.house.name}</div>
          <div className="truncate text-sm text-white/60">{ctx.profile.full_name} · {ROLE_LABEL[ctx.profile.role]}</div>
        </div>
        <Link href="/casas" className="inline-flex min-h-[42px] shrink-0 items-center rounded-full border border-white/25 px-4 text-sm font-semibold text-white active:bg-white/10">
          Menu
        </Link>
      </header>
      <main className="px-4 py-4">{children}</main>
      <Nav items={items} />
    </div>
  );
}
