import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Empty, Flash, Page } from "@/components/ui";
import ExtraCard, { EXTRA_SELECT, type ExtraRow } from "@/components/ExtraCard";
import { addDays, dm, mondayOf, today } from "@/lib/util";

export default async function Pendencias({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const week = mondayOf(today());
  const [{ data }, { data: sectors }, { data: scheds }] = await Promise.all([
    ctx.sb.from("extra_requests").select(EXTRA_SELECT).eq("house_id", ctx.house.id).eq("status", "pending").order("work_date"),
    ctx.sb.from("sectors").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name"),
    ctx.sb.from("schedules").select("sector_id,week_start,status").eq("house_id", ctx.house.id).in("week_start", [week, addDays(week, 7)]),
  ]);
  const rows = (data ?? []) as unknown as ExtraRow[];
  const st = (sid: string, w: string) => (scheds ?? []).find((s) => s.sector_id === sid && s.week_start === w)?.status;

  return (
    <Page title="Pendências" sub={`${rows.length} vaga(s) aguardando`}>
      <Flash msg={searchParams.erro} />
      <Flash msg={searchParams.ok} tone="ok" />
      {rows.length === 0 && <Empty>Nada para aprovar. ✓</Empty>}
      <ul className="space-y-3">{rows.map((e) => <ExtraCard key={e.id} e={e} ret="/pendencias" mode="dp" />)}</ul>

      <div className="card space-y-2">
        <h2 className="font-semibold">Escalas</h2>
        <p className="muted">Semana de {dm(week)} e a próxima.</p>
        <ul className="divide-y divide-stone-100">
          {(sectors ?? []).map((s) => (
            <li key={s.id}>
              <Link href={`/escala?s=${s.id}`} className="flex min-h-[48px] items-center justify-between text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="flex gap-1.5">
                  {[week, addDays(week, 7)].map((w) => {
                    const v = st(s.id, w);
                    return <span key={w} className={`badge ${v === "sent" ? "bg-emerald-100 text-emerald-800" : v ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-500"}`}>{dm(w)} {v === "sent" ? "enviada" : v ? "rascunho" : "—"}</span>;
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
