import Link from "next/link";
import { getCtx, getSectors } from "@/lib/ctx";
import { Empty, Flash, Page, SectorFilter } from "@/components/ui";
import ExtraCard, { EXTRA_SELECT, type ExtraRow } from "@/components/ExtraCard";
import { today } from "@/lib/util";

const FILTERS = [
  ["confirmar", "Confirmar presença"],
  ["pending", "Pendentes"],
  ["approved", "Aprovadas"],
  ["todas", "Todas"],
] as const;

export default async function Extras({ searchParams }: { searchParams: { s?: string; f?: string; erro?: string; ok?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  const sector = sectors.find((x) => x.id === searchParams.s) ?? null;
  const f = searchParams.f ?? "pending";

  let q = ctx.sb.from("extra_requests").select(EXTRA_SELECT).eq("house_id", ctx.house.id)
    .order("work_date", { ascending: false }).order("requested_at", { ascending: false }).limit(80);
  if (sector) q = q.eq("sector_id", sector.id);
  else if (!ctx.isDp) q = q.in("sector_id", sectors.map((x) => x.id));
  if (f === "pending") q = q.eq("status", "pending");
  if (f === "approved") q = q.eq("status", "approved");
  if (f === "confirmar") q = q.eq("status", "approved").is("attendance", null).lte("work_date", today());
  const { data } = await q;
  const rows = (data ?? []) as unknown as ExtraRow[];
  const sp = sector ? `s=${sector.id}&` : "";
  const ret = `/extras?${sp}f=${f}`;

  return (
    <Page title="Extras" sub={sector?.name ?? "Todos os setores"}
      action={<Link href={`/extras/nova${sector ? `?s=${sector.id}` : ""}`} className="chip chip-on">+ Nova vaga</Link>}>
      <SectorFilter sectors={sectors} current={sector?.id} base="/extras" params={`f=${f}`} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/extras?${sp}f=${k}`} className={`chip shrink-0 ${f === k ? "chip-on" : ""}`}>{label}</Link>
        ))}
      </div>
      <Flash msg={searchParams.erro} />
      <Flash msg={searchParams.ok} tone="ok" />
      {rows.length === 0 && <Empty>Nenhuma vaga aqui.</Empty>}
      <ul className="space-y-3">
        {rows.map((e) => <ExtraCard key={e.id} e={e} ret={ret} mode={ctx.isDp ? "dp" : "leader"} />)}
      </ul>
      {ctx.isDp && (
        <Link href="/api/export" className="btn-ghost" prefetch={false}>Baixar Excel (aprovadas do mês)</Link>
      )}
    </Page>
  );
}
