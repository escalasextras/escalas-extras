import Link from "next/link";
import { getCtx, getSectors } from "@/lib/ctx";
import { Empty, Page, SectorFilter } from "@/components/ui";
import Stars from "@/components/Stars";
import { addDays, today } from "@/lib/util";

const PERIODOS: [string, string, number][] = [["7", "7 dias", 7], ["30", "30 dias", 30], ["90", "90 dias", 90]];

export default async function Pontuacao({ searchParams }: { searchParams: { s?: string; p?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  if (sectors.length === 0) return <Empty>Você ainda não tem setor.</Empty>;
  const filter = sectors.find((x) => x.id === searchParams.s) ?? null;
  const per = PERIODOS.find((x) => x[0] === searchParams.p) ?? PERIODOS[1];
  const since = addDays(today(), -per[2]);
  const ids = (filter ? [filter] : sectors).map((x) => x.id);

  const { data: rows } = await ctx.sb.from("checklist_people")
    .select("person_id,checklist_runs!inner(avg,day,sector_id),people!inner(name,sector_id,positions!position_id(name))")
    .in("checklist_runs.sector_id", ids).gte("checklist_runs.day", since);
  const acc = new Map<string, { name: string; cargo: string; sum: number; n: number }>();
  for (const r of (rows ?? []) as any[]) {
    const a = acc.get(r.person_id) ?? { name: r.people.name, cargo: r.people.positions?.name ?? "", sum: 0, n: 0 };
    a.sum += Number(r.checklist_runs.avg); a.n++;
    acc.set(r.person_id, a);
  }
  const rank = [...acc.entries()].map(([id, a]) => ({ id, ...a, avg: a.sum / a.n })).sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
  const sp = filter ? `s=${filter.id}&` : "";

  return (
    <Page title="Pontuação" sub={`Média dos checklists · ${filter?.name ?? "Todos os setores"}`} action={<Link href="/checklist" className="chip">Checklist</Link>}>
      <SectorFilter sectors={sectors} current={filter?.id} base="/pontuacao" params={`p=${per[0]}`} />
      <div className="flex gap-2">
        {PERIODOS.map(([k, l]) => <Link key={k} href={`/pontuacao?${sp}p=${k}`} className={`chip ${k === per[0] ? "chip-on" : ""}`}>{l}</Link>)}
      </div>
      {rank.length === 0 ? <Empty>Nenhum checklist avaliado neste período.</Empty> : (
        <ul className="space-y-2">
          {rank.map((r, i) => (
            <li key={r.id}>
              <Link href={`/equipe/${r.id}`} className="card flex items-center justify-between gap-3 active:bg-stone-100">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-bold">{i + 1}</span>
                  <div className="min-w-0"><div className="truncate font-semibold">{r.name}</div><div className="muted truncate">{r.cargo} · {r.n} checklist{r.n > 1 ? "s" : ""}</div></div>
                </div>
                <Stars value={r.avg} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
