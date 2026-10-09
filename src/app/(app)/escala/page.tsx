import Link from "next/link";
import { getCtx, getSectors } from "@/lib/ctx";
import { Empty, Flash, Page, SectorFilter } from "@/components/ui";
import { back, refresh } from "@/lib/act";
import { addDays, dm, hm, mondayOf, today, weekday } from "@/lib/util";

async function ensureSchedule(ctx: Awaited<ReturnType<typeof getCtx>>, sector_id: string, week: string) {
  const { data: cur } = await ctx.sb.from("schedules").select("id,status").eq("sector_id", sector_id).eq("week_start", week).maybeSingle();
  if (cur) return cur;
  const { data, error } = await ctx.sb.from("schedules").insert({ house_id: ctx.house.id, sector_id, week_start: week }).select("id,status").single();
  if (error) throw new Error(error.message);
  return data;
}

// "f" é o filtro de setor da tela (vazio = Todos); "s" é o setor da pessoa/escala
const retUrl = (f: string, w: string, d: string) => `/escala?${f ? `s=${f}&` : ""}w=${w}&d=${d}`;

async function alternar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const s = String(formData.get("s")), w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const ret = retUrl(f, w, d);
  try {
    const sch = await ensureSchedule(ctx, s, w);
    const person_id = String(formData.get("person")), shift_id = String(formData.get("shift"));
    const { data: ex } = await ctx.sb.from("schedule_entries").select("id").eq("schedule_id", sch.id).eq("person_id", person_id).eq("day", d).eq("shift_id", shift_id).maybeSingle();
    if (ex) await ctx.sb.from("schedule_entries").delete().eq("id", ex.id);
    else {
      const { error } = await ctx.sb.from("schedule_entries").insert({ house_id: ctx.house.id, schedule_id: sch.id, person_id, day: d, shift_id });
      if (error) throw new Error(error.message);
    }
    // alterou depois de enviada: volta para rascunho
    if (sch.status === "sent") await ctx.sb.from("schedules").update({ status: "draft", sent_at: null }).eq("id", sch.id);
  } catch (e: any) {
    back(ret, e.message);
  }
  refresh("/escala");
  back(ret);
}

async function folga(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const s = String(formData.get("s")), w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const sch = await ensureSchedule(ctx, s, w);
  await ctx.sb.from("schedule_entries").delete().eq("schedule_id", sch.id).eq("person_id", String(formData.get("person"))).eq("day", d);
  refresh("/escala");
  back(retUrl(f, w, d));
}

// copiar e enviar valem para todos os setores da tela (um só, ou todos)
async function copiar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const targets = String(formData.get("t") ?? "").split(",").filter(Boolean);
  const ret = retUrl(f, w, d);
  const prev = addDays(w, -7);
  let copied = 0;
  for (const s of targets) {
    const { data: ps } = await ctx.sb.from("schedules").select("id").eq("sector_id", s).eq("week_start", prev).maybeSingle();
    if (!ps) continue;
    const { data: old } = await ctx.sb.from("schedule_entries").select("person_id,day,shift_id,people!inner(active),shifts!inner(active)").eq("schedule_id", ps.id);
    const rows = (old ?? []).filter((r: any) => r.people.active && r.shifts.active);
    if (!rows.length) continue;
    const sch = await ensureSchedule(ctx, s, w);
    const { error } = await ctx.sb.from("schedule_entries").upsert(
      rows.map((r: any) => ({ house_id: ctx.house.id, schedule_id: sch.id, person_id: r.person_id, shift_id: r.shift_id, day: addDays(r.day, 7) })),
      { onConflict: "schedule_id,person_id,day,shift_id", ignoreDuplicates: true }
    );
    if (error) back(ret, error.message);
    copied++;
  }
  if (!copied) back(ret, "A semana anterior não tem escala para copiar.");
  refresh("/escala");
  back(ret, "Semana anterior copiada.", "ok");
}

async function enviar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const targets = String(formData.get("t") ?? "").split(",").filter(Boolean);
  for (const s of targets) {
    const sch = await ensureSchedule(ctx, s, w);
    const { error } = await ctx.sb.from("schedules").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", sch.id);
    if (error) back(retUrl(f, w, d), error.message);
  }
  refresh("/escala");
  back(retUrl(f, w, d), "Escala enviada ao DP.", "ok");
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
function overlap(a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }) {
  const norm = (x: typeof a): [number, number] => {
    const s = toMin(x.start_time); let e = toMin(x.end_time); if (e <= s) e += 1440; return [s, e];
  };
  const [as, ae] = norm(a), [bs, be] = norm(b);
  return as < be && bs < ae;
}

export default async function Escala({ searchParams }: { searchParams: { s?: string; w?: string; d?: string; erro?: string; ok?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  if (sectors.length === 0) return <Empty>Você ainda não tem setor. Fale com o Admin.</Empty>;
  // setor é só filtro: sem filtro, a tela mostra todos os setores
  const filter = sectors.find((x) => x.id === searchParams.s) ?? null;
  const shown = filter ? [filter] : sectors;
  const ids = shown.map((x) => x.id);
  const f = filter?.id ?? "";

  const week = mondayOf(searchParams.w ?? today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const day = days.includes(searchParams.d ?? "") ? searchParams.d! : days.includes(today()) ? today() : days[0];

  const [{ data: shifts }, { data: people }, { data: schs }] = await Promise.all([
    ctx.sb.from("shifts").select("id,name,start_time,end_time,sector_id").in("sector_id", ids).eq("active", true).order("start_time"),
    ctx.sb.from("people").select("id,name,sector_id,positions!position_id(name)").in("sector_id", ids).eq("active", true).eq("kind", "employee").order("name"),
    ctx.sb.from("schedules").select("id,status,sector_id").in("sector_id", ids).eq("week_start", week),
  ]);
  const schIds = (schs ?? []).map((x) => x.id);
  const { data: entries } = schIds.length
    ? await ctx.sb.from("schedule_entries").select("person_id,day,shift_id").in("schedule_id", schIds)
    : { data: [] as { person_id: string; day: string; shift_id: string }[] };

  const key = (p: string, d: string) => `${p}|${d}`;
  const byPD = new Map<string, Set<string>>();
  const dayCount = new Map<string, Set<string>>();
  for (const e of entries ?? []) {
    const k = key(e.person_id, e.day);
    (byPD.get(k) ?? byPD.set(k, new Set()).get(k)!).add(e.shift_id);
    (dayCount.get(e.day) ?? dayCount.set(e.day, new Set()).get(e.day)!).add(e.person_id);
  }
  const shiftMap = new Map((shifts ?? []).map((s) => [s.id, s]));
  const shiftsOf = (sector_id: string) => (shifts ?? []).filter((x) => x.sector_id === sector_id);
  const sectorName = new Map(sectors.map((x) => [x.id, x.name]));
  const base = `/escala?${f ? `s=${f}&` : ""}`;
  const hidden = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="f" value={f} /><input type="hidden" name="w" value={week} /><input type="hidden" name="d" value={day} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const allSent = (schs ?? []).length > 0 && (schs ?? []).every((x) => x.status === "sent");
  const status = allSent ? { t: "Enviada ao DP", c: "bg-emerald-100 text-emerald-800" } : { t: "Rascunho", c: "bg-amber-100 text-amber-800" };

  return (
    <Page title="Escala" sub={filter?.name ?? "Todos os setores"} action={<span className={`badge ${status.c}`}>{status.t}</span>}>
      <SectorFilter sectors={sectors} current={filter?.id} base="/escala" params={`w=${week}`} />
      <Flash msg={searchParams.erro} />
      <Flash msg={searchParams.ok} tone="ok" />

      <div className="flex items-center justify-between">
        <Link href={`${base}w=${addDays(week, -7)}`} className="chip" aria-label="Semana anterior">‹ Anterior</Link>
        <span className="text-sm font-semibold">{dm(week)} a {dm(addDays(week, 6))}</span>
        <Link href={`${base}w=${addDays(week, 7)}`} className="chip" aria-label="Próxima semana">Próxima ›</Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d) => (
          <Link key={d} href={`${base}w=${week}&d=${d}`}
            className={`flex min-h-[64px] min-w-[52px] shrink-0 flex-col items-center justify-center rounded-xl border text-sm ${d === day ? "border-teal-700 bg-teal-700 text-white" : "border-stone-300 bg-white"}`}>
            <span className="text-xs font-medium opacity-80">{weekday(d)}</span>
            <span className="font-display text-lg font-bold leading-none">{d.slice(8)}</span>
            <span className="mt-0.5 rounded-full bg-black/10 px-1.5 text-[11px] font-bold">{dayCount.get(d)?.size ?? 0}</span>
          </Link>
        ))}
      </div>

      {(shifts ?? []).length === 0 ? (
        <Empty>{filter ? "Este setor ainda não tem turnos." : "Nenhum setor tem turnos ainda."} {ctx.isDp ? <Link className="font-semibold text-teal-700" href="/config/turnos">Cadastrar turnos</Link> : "Peça ao DP para cadastrar."}</Empty>
      ) : (people ?? []).length === 0 ? (
        <Empty>Cadastre a equipe na aba Equipe.</Empty>
      ) : (
        <ul className="space-y-2">
          {(people ?? []).map((p: any) => {
            const own = shiftsOf(p.sector_id);
            const sel = byPD.get(key(p.id, day)) ?? new Set<string>();
            const chosen = [...sel].map((id) => shiftMap.get(id)!).filter(Boolean);
            const clash = chosen.some((a, i) => chosen.slice(i + 1).some((b) => overlap(a, b)));
            return (
              <li key={p.id} className="card">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="muted truncate">{p.positions?.name ?? "Sem cargo"} · {sectorName.get(p.sector_id)}</div>
                  </div>
                  {sel.size === 0 && <span className="badge bg-stone-100 text-stone-500">Folga</span>}
                </div>
                {own.length === 0 ? (
                  <p className="muted">O setor {sectorName.get(p.sector_id)} ainda não tem turnos.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {own.map((sh) => (
                      <form key={sh.id} action={alternar}>
                        {hidden({ s: p.sector_id, person: p.id, shift: sh.id })}
                        <button className={`chip ${sel.has(sh.id) ? "chip-on" : ""}`}>
                          {sh.name} <span className="ml-1 text-xs opacity-75">{hm(sh.start_time)}–{hm(sh.end_time)}</span>
                        </button>
                      </form>
                    ))}
                    {sel.size > 0 && (
                      <form action={folga}>{hidden({ s: p.sector_id, person: p.id })}<button className="chip text-stone-500">Folga</button></form>
                    )}
                  </div>
                )}
                {clash && <p className="mt-2 text-sm font-medium text-red-700">Atenção: turnos sobrepostos neste dia</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 pt-2">
        <form action={enviar}>{hidden({ t: ids.join(",") })}<button className="btn">{allSent ? "Reenviar escala" : filter ? "Enviar escala ao DP" : "Enviar todas as escalas ao DP"}</button></form>
        <form action={copiar}>{hidden({ t: ids.join(",") })}<button className="btn-ghost">Copiar semana anterior</button></form>
      </div>
    </Page>
  );
}
