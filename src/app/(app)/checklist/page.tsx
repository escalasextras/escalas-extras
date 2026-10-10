import Link from "next/link";
import { getCtx, getSectors } from "@/lib/ctx";
import { Empty, Flash, Page, SectorFilter } from "@/components/ui";
import Stars from "@/components/Stars";
import { addDays, dm, hm, today, weekday } from "@/lib/util";
import { presenceForDay } from "@/lib/presence";

export default async function Checklist({ searchParams }: { searchParams: { s?: string; d?: string; erro?: string; ok?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  if (sectors.length === 0) return <Empty>Você ainda não tem setor. Fale com o Admin.</Empty>;
  const filter = sectors.find((x) => x.id === searchParams.s) ?? null;
  const shown = filter ? [filter] : sectors;
  const ids = shown.map((x) => x.id);
  const f = filter?.id ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? searchParams.d! : today();
  const base = `/checklist?${f ? `s=${f}&` : ""}`;

  const [{ data: shifts }, { data: runs }, { data: items }, present] = await Promise.all([
    ctx.sb.from("shifts").select("id,name,start_time,end_time,sector_id").in("sector_id", ids).eq("active", true).order("start_time"),
    ctx.sb.from("checklist_runs").select("id,shift_id,avg").in("sector_id", ids).eq("day", day),
    ctx.sb.from("checklist_items").select("id,sector_id").in("sector_id", ids).eq("active", true),
    presenceForDay(ctx.sb, ids, day),
  ]);
  const runBy = new Map((runs ?? []).map((r) => [r.shift_id, r]));
  const itemsBy = new Map<string, number>();
  (items ?? []).forEach((i) => itemsBy.set(i.sector_id, (itemsBy.get(i.sector_id) ?? 0) + 1));
  const sectorName = new Map(sectors.map((x) => [x.id, x.name]));

  return (
    <Page title="Checklist" sub={filter?.name ?? "Todos os setores"} action={<Link href={`/pontuacao${f ? `?s=${f}` : ""}`} className="chip">Pontuação</Link>}>
      <SectorFilter sectors={sectors} current={filter?.id} base="/checklist" params={`d=${day}`} />
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <div className="flex items-center justify-between">
        <Link href={`${base}d=${addDays(day, -1)}`} className="chip">‹ Ontem</Link>
        <span className="text-sm font-semibold">{weekday(day)} {dm(day)}{day === today() ? " · hoje" : ""}</span>
        <Link href={`${base}d=${addDays(day, 1)}`} className="chip">Amanhã ›</Link>
      </div>

      {(shifts ?? []).length === 0 ? (
        <Empty>Nenhum turno cadastrado nos setores.</Empty>
      ) : (
        <ul className="space-y-2">
          {(shifts ?? []).map((sh) => {
            const run = runBy.get(sh.id);
            const n = present.get(sh.id)?.length ?? 0;
            const hasItems = (itemsBy.get(sh.sector_id) ?? 0) > 0;
            return (
              <li key={sh.id}>
                <Link href={`/checklist/avaliar?s=${sh.sector_id}&d=${day}&sh=${sh.id}${f ? `&f=${f}` : ""}`} className="card flex min-h-[64px] items-center justify-between gap-3 active:bg-stone-100">
                  <div className="min-w-0">
                    <div className="font-semibold">{sh.name} <span className="text-sm font-normal text-stone-500">{hm(sh.start_time)}–{hm(sh.end_time)}</span></div>
                    <div className="muted truncate">{filter ? "" : `${sectorName.get(sh.sector_id)} · `}{n} na escala{!hasItems ? " · sem itens" : ""}</div>
                  </div>
                  {run ? <Stars value={Number(run.avg)} /> : <span className="badge bg-amber-100 text-amber-800">Pendente</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
