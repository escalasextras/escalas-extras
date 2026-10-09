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

async function touch(ctx: Awaited<ReturnType<typeof getCtx>>, sch: { id: string; status: string }) {
  // alterou depois de enviada: volta para rascunho
  if (sch.status === "sent") await ctx.sb.from("schedules").update({ status: "draft", sent_at: null }).eq("id", sch.id);
}

// Folga no dia: não mexe no turno base da pessoa
async function folga(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const s = String(formData.get("s")), w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const ret = retUrl(f, w, d);
  try {
    const sch = await ensureSchedule(ctx, s, w);
    const person_id = String(formData.get("person"));
    await ctx.sb.from("schedule_entries").delete().eq("schedule_id", sch.id).eq("person_id", person_id).eq("day", d);
    const { error } = await ctx.sb.from("schedule_offs").upsert(
      { house_id: ctx.house.id, schedule_id: sch.id, person_id, day: d },
      { onConflict: "schedule_id,person_id,day", ignoreDuplicates: true }
    );
    if (error) throw new Error(error.message);
    await touch(ctx, sch);
  } catch (e: any) {
    back(ret, e.message);
  }
  refresh("/escala");
  back(ret);
}

// Volta ao turno base: tira a folga e qualquer troca do dia
async function voltar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const s = String(formData.get("s")), w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const sch = await ensureSchedule(ctx, s, w);
  const person_id = String(formData.get("person"));
  await ctx.sb.from("schedule_offs").delete().eq("schedule_id", sch.id).eq("person_id", person_id).eq("day", d);
  await ctx.sb.from("schedule_entries").delete().eq("schedule_id", sch.id).eq("person_id", person_id).eq("day", d);
  await touch(ctx, sch);
  refresh("/escala");
  back(retUrl(f, w, d));
}

// Troca de turno só neste dia (a base da pessoa continua a mesma)
async function trocar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const s = String(formData.get("s")), w = String(formData.get("w")), d = String(formData.get("d")), f = String(formData.get("f") ?? "");
  const ret = retUrl(f, w, d);
  try {
    const sch = await ensureSchedule(ctx, s, w);
    const person_id = String(formData.get("person")), shift_id = String(formData.get("shift"));
    await ctx.sb.from("schedule_offs").delete().eq("schedule_id", sch.id).eq("person_id", person_id).eq("day", d);
    await ctx.sb.from("schedule_entries").delete().eq("schedule_id", sch.id).eq("person_id", person_id).eq("day", d);
    const { data: pe } = await ctx.sb.from("people").select("base_shift_id").eq("id", person_id).single();
    if (pe?.base_shift_id !== shift_id) {
      const { error } = await ctx.sb.from("schedule_entries").insert({ house_id: ctx.house.id, schedule_id: sch.id, person_id, day: d, shift_id });
      if (error) throw new Error(error.message);
    }
    await touch(ctx, sch);
  } catch (e: any) {
    back(ret, e.message);
  }
  refresh("/escala");
  back(ret);
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
    const { data: offs } = await ctx.sb.from("schedule_offs").select("person_id,day,people!inner(active)").eq("schedule_id", ps.id);
    const offRows = (offs ?? []).filter((r: any) => r.people.active);
    if (!rows.length && !offRows.length) continue;
    const sch = await ensureSchedule(ctx, s, w);
    if (offRows.length) {
      const { error: e2 } = await ctx.sb.from("schedule_offs").upsert(
        offRows.map((r: any) => ({ house_id: ctx.house.id, schedule_id: sch.id, person_id: r.person_id, day: addDays(r.day, 7) })),
        { onConflict: "schedule_id,person_id,day", ignoreDuplicates: true }
      );
      if (e2) back(ret, e2.message);
    }
    if (!rows.length) { copied++; continue; }
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
    ctx.sb.from("people").select("id,name,sector_id,base_shift_id,positions!position_id(name)").in("sector_id", ids).eq("active", true).eq("kind", "employee").order("name"),
    ctx.sb.from("schedules").select("id,status,sector_id").in("sector_id", ids).eq("week_start", week),
  ]);
  const schIds = (schs ?? []).map((x) => x.id);
  const [{ data: entries }, { data: offs }] = schIds.length
    ? await Promise.all([
        ctx.sb.from("schedule_entries").select("person_id,day,shift_id").in("schedule_id", schIds),
        ctx.sb.from("schedule_offs").select("person_id,day").in("schedule_id", schIds),
      ])
    : [{ data: [] as { person_id: string; day: string; shift_id: string }[] }, { data: [] as { person_id: string; day: string }[] }];

  const key = (p: string, d: string) => `${p}|${d}`;
  const offSet = new Set((offs ?? []).map((o) => key(o.person_id, o.day)));
  const overrideOf = new Map<string, string>();
  for (const e of entries ?? []) overrideOf.set(key(e.person_id, e.day), e.shift_id);
  const shiftMap = new Map((shifts ?? []).map((s) => [s.id, s]));
  const shiftsOf = (sector_id: string) => (shifts ?? []).filter((x) => x.sector_id === sector_id);
  const sectorName = new Map(sectors.map((x) => [x.id, x.name]));

  // turno efetivo da pessoa no dia: folga > troca do dia > turno base
  type St = { kind: "off" } | { kind: "shift"; shift_id: string; swapped: boolean } | { kind: "none" };
  const stateOf = (p: any, d: string): St => {
    const k = key(p.id, d);
    if (offSet.has(k)) return { kind: "off" };
    const o = overrideOf.get(k);
    if (o && shiftMap.has(o)) return { kind: "shift", shift_id: o, swapped: o !== p.base_shift_id };
    if (p.base_shift_id && shiftMap.has(p.base_shift_id)) return { kind: "shift", shift_id: p.base_shift_id, swapped: false };
    return { kind: "none" };
  };
  const dayCount = new Map<string, number>();
  for (const d of days) dayCount.set(d, (people ?? []).filter((p) => stateOf(p, d).kind === "shift").length);

  const base = `/escala?${f ? `s=${f}&` : ""}`;
  const hidden = (extra: Record<string, string> = {}) => (
    <>
      <input type="hidden" name="f" value={f} /><input type="hidden" name="w" value={week} /><input type="hidden" name="d" value={day} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const allSent = (schs ?? []).length > 0 && (schs ?? []).every((x) => x.status === "sent");
  const status = allSent ? { t: "Enviada ao DP", c: "bg-emerald-100 text-emerald-800" } : { t: "Rascunho", c: "bg-amber-100 text-amber-800" };

  const states = (people ?? []).map((p: any) => ({ p, st: stateOf(p, day) }));
  const offList = states.filter((x) => x.st.kind === "off");
  const noneList = states.filter((x) => x.st.kind === "none");

  const Person = ({ p, st }: { p: any; st: St }) => {
    const own = shiftsOf(p.sector_id);
    return (
      <li className="rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-semibold">{p.name}</div>
            <div className="muted truncate">{p.positions?.name ?? "Sem cargo"}{filter ? "" : ` · ${sectorName.get(p.sector_id)}`}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {st.kind === "shift" && st.swapped && <span className="badge bg-amber-100 text-amber-800">Troca do dia</span>}
            {st.kind === "shift" && (
              <form action={folga}>{hidden({ s: p.sector_id, person: p.id })}<button className="chip">Folga</button></form>
            )}
            {st.kind !== "shift" && st.kind === "off" && (
              <form action={voltar}>{hidden({ s: p.sector_id, person: p.id })}<button className="chip">Voltar ao turno</button></form>
            )}
          </div>
        </div>
        {own.length > 1 || st.kind !== "shift" ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium text-teal-700">{st.kind === "shift" ? "Trocar turno só hoje" : "Escalar em um turno hoje"}</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {own.filter((sh) => !(st.kind === "shift" && sh.id === st.shift_id)).map((sh) => (
                <form key={sh.id} action={trocar}>
                  {hidden({ s: p.sector_id, person: p.id, shift: sh.id })}
                  <button className="chip">{sh.name} <span className="ml-1 text-xs opacity-75">{hm(sh.start_time)}–{hm(sh.end_time)}</span></button>
                </form>
              ))}
              {st.kind === "shift" && st.swapped && (
                <form action={voltar}>{hidden({ s: p.sector_id, person: p.id })}<button className="chip text-stone-500">Voltar ao turno base</button></form>
              )}
            </div>
          </details>
        ) : null}
      </li>
    );
  };

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
            <span className="mt-0.5 rounded-full bg-black/10 px-1.5 text-[11px] font-bold">{dayCount.get(d) ?? 0}</span>
          </Link>
        ))}
      </div>

      {(shifts ?? []).length === 0 ? (
        <Empty>{filter ? "Este setor ainda não tem turnos." : "Nenhum setor tem turnos ainda."} {ctx.isDp ? <Link className="font-semibold text-teal-700" href="/config/turnos">Cadastrar turnos</Link> : "Peça ao DP para cadastrar."}</Empty>
      ) : (people ?? []).length === 0 ? (
        <Empty>Cadastre a equipe na aba Equipe.</Empty>
      ) : (
        <div className="space-y-5">
          {(shifts ?? []).map((sh) => {
            const here = states.filter((x) => x.st.kind === "shift" && x.st.shift_id === sh.id);
            return (
              <section key={sh.id}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-base font-bold">{sh.name} <span className="text-sm font-medium text-stone-500">{hm(sh.start_time)}–{hm(sh.end_time)}</span></h2>
                  <span className="muted">{filter ? "" : `${sectorName.get(sh.sector_id)} · `}{here.length} presente(s)</span>
                </div>
                <Link href={`/extras/nova?s=${sh.sector_id}&d=${day}&sh=${sh.id}`} className="mb-2 flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-teal-700 text-sm font-semibold text-teal-700 active:bg-teal-50">
                  + Criar vaga extra neste turno
                </Link>
                {here.length === 0
                  ? <p className="muted rounded-xl border border-dashed border-stone-300 p-3">Ninguém neste turno. Vincule o turno base na ficha da pessoa (Equipe) ou use “Escalar em um turno hoje”.</p>
                  : <ul className="space-y-2">{here.map((x) => <Person key={x.p.id} p={x.p} st={x.st} />)}</ul>}
              </section>
            );
          })}

          {noneList.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-base font-bold">Sem turno <span className="text-sm font-medium text-stone-500">({noneList.length})</span></h2>
              <ul className="space-y-2">{noneList.map((x) => <Person key={x.p.id} p={x.p} st={x.st} />)}</ul>
            </section>
          )}

          {offList.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-base font-bold">Folga <span className="text-sm font-medium text-stone-500">({offList.length})</span></h2>
              <ul className="space-y-2">{offList.map((x) => <Person key={x.p.id} p={x.p} st={x.st} />)}</ul>
            </section>
          )}
        </div>
      )}

      <div className="space-y-2 pt-2">
        <Link href={`/extras/nova?${filter ? `s=${filter.id}&` : ""}d=${day}`} className="btn-ghost flex items-center justify-center">+ Criar vaga extra em {dm(day)}</Link>
        <form action={enviar}>{hidden({ t: ids.join(",") })}<button className="btn">{allSent ? "Reenviar escala" : filter ? "Enviar escala ao DP" : "Enviar todas as escalas ao DP"}</button></form>
        <form action={copiar}>{hidden({ t: ids.join(",") })}<button className="btn-ghost">Copiar semana anterior</button></form>
      </div>
    </Page>
  );
}
