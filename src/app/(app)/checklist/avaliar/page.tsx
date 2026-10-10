import Link from "next/link";
import { notFound } from "next/navigation";
import { getCtx, getSectors } from "@/lib/ctx";
import { Empty, Flash, Page } from "@/components/ui";
import { back, refresh } from "@/lib/act";
import StarInput from "@/components/StarInput";
import SubmitButton from "@/components/SubmitButton";
import { dm, hm, weekday } from "@/lib/util";
import { presenceForDay } from "@/lib/presence";

async function salvar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const g = (k: string) => String(formData.get(k) ?? "");
  const s = g("s"), d = g("d"), sh = g("sh"), f = g("f");
  const me = `/checklist/avaliar?s=${s}&d=${d}&sh=${sh}${f ? `&f=${f}` : ""}`;
  const sectors = await getSectors(ctx);
  if (!sectors.some((x) => x.id === s)) back("/checklist", "Sem acesso a este setor.");
  const { data: items } = await ctx.sb.from("checklist_items").select("id").eq("sector_id", s).eq("active", true);
  if (!items?.length) back(me, "Este setor não tem itens de checklist.");
  const stars = new Map<string, number>();
  for (const it of items!) {
    const v = Number(g(`i_${it.id}`));
    if (!(v >= 1 && v <= 5)) back(me, "Dê de 1 a 5 estrelas em todos os itens.");
    stars.set(it.id, v);
  }
  const avg = [...stars.values()].reduce((a, b) => a + b, 0) / stars.size;

  const { data: run, error } = await ctx.sb.from("checklist_runs").upsert(
    { house_id: ctx.house.id, sector_id: s, shift_id: sh, day: d, avg: Math.round(avg * 100) / 100, note: g("note").trim() || null, rated_by: ctx.profile.id, updated_at: new Date().toISOString() },
    { onConflict: "sector_id,day,shift_id" }
  ).select("id").single();
  if (error || !run) back(me, error?.message ?? "Não foi possível salvar.");
  await ctx.sb.from("checklist_scores").delete().eq("run_id", run!.id);
  const r1 = await ctx.sb.from("checklist_scores").insert([...stars].map(([item_id, st]) => ({ run_id: run!.id, item_id, stars: st })));
  if (r1.error) back(me, r1.error.message);
  // quem estava na escala do turno neste dia recebe a nota
  const pres = (await presenceForDay(ctx.sb, [s], d)).get(sh) ?? [];
  await ctx.sb.from("checklist_people").delete().eq("run_id", run!.id);
  if (pres.length) {
    const r2 = await ctx.sb.from("checklist_people").insert(pres.map((p) => ({ run_id: run!.id, person_id: p.id, is_extra: p.extra })));
    if (r2.error) back(me, r2.error.message);
  }
  refresh("/checklist", "/pontuacao", "/equipe");
  back(`/checklist?${f ? `s=${f}&` : ""}d=${d}`, `Checklist salvo: ${avg.toFixed(1)} estrelas para ${pres.length} pessoa(s).`, "ok");
}

export default async function Avaliar({ searchParams }: { searchParams: { s?: string; d?: string; sh?: string; f?: string; erro?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  const sector = sectors.find((x) => x.id === searchParams.s);
  const day = searchParams.d ?? "";
  if (!sector || !/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const { data: shift } = await ctx.sb.from("shifts").select("id,name,start_time,end_time").eq("id", searchParams.sh ?? "").eq("sector_id", sector.id).maybeSingle();
  if (!shift) notFound();

  const [{ data: items }, { data: run }, pres] = await Promise.all([
    ctx.sb.from("checklist_items").select("id,name").eq("sector_id", sector.id).eq("active", true).order("sort").order("name"),
    ctx.sb.from("checklist_runs").select("id,note,avg").eq("sector_id", sector.id).eq("day", day).eq("shift_id", shift.id).maybeSingle(),
    presenceForDay(ctx.sb, [sector.id], day),
  ]);
  const { data: prev } = run ? await ctx.sb.from("checklist_scores").select("item_id,stars").eq("run_id", run.id) : { data: [] as { item_id: string; stars: number }[] };
  const prevBy = new Map((prev ?? []).map((p) => [p.item_id, p.stars]));
  const people = pres.get(shift.id) ?? [];
  const back_ = `/checklist?${searchParams.f ? `s=${searchParams.f}&` : ""}d=${day}`;

  return (
    <Page title="Avaliar" sub={`${sector.name} · ${shift.name} ${hm(shift.start_time)}–${hm(shift.end_time)} · ${weekday(day)} ${dm(day)}`}
      action={<Link href={back_} className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} />
      {(items ?? []).length === 0 ? (
        <Empty>Este setor ainda não tem itens de checklist. {ctx.isDp ? <Link className="font-semibold text-teal-700" href="/config/checklist">Cadastrar itens</Link> : "Peça ao DP para cadastrar."}</Empty>
      ) : (
        <form action={salvar} className="space-y-3">
          {["s", "d", "sh", "f"].map((k) => <input key={k} type="hidden" name={k} value={k === "s" ? sector.id : k === "d" ? day : k === "sh" ? shift.id : searchParams.f ?? ""} />)}
          {run && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Já avaliado ({Number(run.avg).toFixed(1)}). Salvar de novo substitui a avaliação.</p>}
          <ul className="space-y-2">
            {(items ?? []).map((it) => (
              <li key={it.id} className="card">
                <div className="mb-1 font-semibold">{it.name}</div>
                <StarInput name={`i_${it.id}`} defaultValue={prevBy.get(it.id) ?? 0} />
              </li>
            ))}
          </ul>
          <div><label className="label">Observação (opcional)</label><input name="note" className="input" defaultValue={run?.note ?? ""} /></div>
          <div className="card">
            <p className="font-semibold">Recebem esta nota ({people.length})</p>
            {people.length === 0
              ? <p className="muted">Ninguém na escala deste turno neste dia. Vincule o turno base na Equipe ou escale na Escala.</p>
              : <p className="muted">{people.map((p) => p.name + (p.extra ? " (extra)" : "")).join(", ")}</p>}
          </div>
          <SubmitButton>Salvar checklist</SubmitButton>
        </form>
      )}
    </Page>
  );
}
