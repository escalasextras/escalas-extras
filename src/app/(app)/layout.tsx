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
      { href: "/pendencias", label: "Pendências", icon: "✓", badge: count ?? 0 },
      { href: "/escala", label: "Escalas", icon: "▦" },
      { href: "/extras", label: "Extras", icon: "＋" },
      { href: "/equipe", label: "Equipe", icon: "☺" },
      { href: "/config", label: "Config.", icon: "⚙" },
    ];
  } else {
    items = [
      { href: "/escala", label: "Escala", icon: "▦" },
      { href: "/extras", label: "Extras", icon: "＋" },
      { href: "/equipe", label: "Equipe", icon: "☺" },
    ];
  }
  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{ctx.house.name}</div>
          <div className="muted truncate">{ctx.profile.full_name} · {ROLE_LABEL[ctx.profile.role]}</div>
        </div>
        <Link href="/casas" className="chip shrink-0 text-xs">
          Menu
        </Link>
      </header>
      <main className="px-4 py-4">{children}</main>
      <Nav items={items} />
    </div>
  );
}
