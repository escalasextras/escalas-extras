import Link from "next/link";
import { redirect } from "next/navigation";
import { getCtx, getSectors, pickSector } from "@/lib/ctx";
import { Empty, Flash, Page, SectorPicker } from "@/components/ui";
import { back, refresh } from "@/lib/act";
import { brl, dm, hm, today, weekday } from "@/lib/util";

type SP = { s?: string; d?: string; sh?: string; pos?: string; rs?: string; ab?: string; p?: string; erro?: string };

function url(sp: SP, over: Partial<SP>) {
  const m = { ...sp, ...over } as Record<string, string | undefined>;
  delete m.erro;
  const q = Object.entries(m).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&");
  return `/extras/nova?${q}`;
}

async function criar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const g = (k: string) => String(formData.get(k) ?? "");
  const retq = ["s", "d", "sh", "pos", "rs", "ab", "p"].map((k) => `${k}=${encodeURIComponent(g(k))}`).join("&");
  const { error } = await ctx.sb.from("extra_requests").insert({
    house_id: ctx.house.id, sector_id: g("s"), shift_id: g("sh"), position_id: g("pos"), work_date: g("d"),
    reason_id: g("rs"), absent_person_id: g("ab") || null, person_id: g("p"), note: g("note").trim() || null,
    amount: 0, // o banco define o valor pela tabela da casa
  });
  if (error) back(`/extras/nova?${retq}`, error.message);
  refresh("/extras", "/pendencias");
  back(`/extras?s=${g("s")}&f=pending`, "Vaga enviada ao DP.", "ok");
}

export default async function Nova({ searchParams }: { searchParams: SP }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  const sector = pickSector(sectors, searchParams.s);
  if (!sector) redirect("/extras");
  const sp: SP = { ...searchParams, s: sector.id };

  const [{ data: shifts }, { data: reasons }] = await Promise.all([
    ctx.sb.from("shifts").select("id,name,start_time,end_time").eq("sector_id", sector.id).eq("active", true).order("start_time"),
    ctx.sb.from("extra_reasons").select("id,name,needs_absent_person,needs_note,is_test").eq("house_id", ctx.house.id).eq("active", true).order("name"),
  ]);
  const shift = (shifts ?? []).find((x) => x.id === sp.sh);
  const date = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : undefined;
  const reason = (reasons ?? []).find((x) => x.id === sp.rs);

  // resumo do que já foi escolhido, cada item com link para alterar
  const [{ data: posAll }, { data: peopleAll }] = await Promise.all([
    ctx.sb.from("positions").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name"),
    ctx.sb.from("people").select("id,name,kind,position_id").eq("sector_id", sector.id).eq("active", true).order("name"),
  ]);
  const position = (posAll ?? []).find((x) => x.id === sp.pos);
  const absent = (peopleAll ?? []).find((x) => x.id === sp.ab);
  const person = (peopleAll ?? []).find((x) => x.id === sp.p);

  let step: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  if (shift && date) step = 2;
  if (step === 2 && position) step = 3;
  if (step === 3 && reason) step = reason.needs_absent_person && !absent ? 4 : 5;
  if (step === 5 && person) step = 6;

  const recap: [string, string, string][] = [];
  if (shift && date) recap.push(["Quando", `${weekday(date)} ${dm(date)} · ${shift.name} ${hm(shift.start_time)}–${hm(shift.end_time)}`, url(sp, { sh: "", pos: "", rs: "", ab: "", p: "" })]);
  if (position) recap.push(["Cargo", position.name, url(sp, { pos: "", rs: "", ab: "", p: "" })]);
  if (reason) recap.push(["Motivo", reason.name, url(sp, { rs: "", ab: "", p: "" })]);
  if (absent) recap.push(["Quem faltou", absent.name, url(sp, { ab: "", p: "" })]);
  if (person) recap.push(["Pessoa", person.name, url(sp, { p: "" })]);

  // valor do cargo escolhido (cálculo no banco)
  let rate: number | null = null;
  const rateOf = async (pos: string) => {
    const { data } = await ctx.sb.rpc("resolve_rate", { h: ctx.house.id, pos, sec: sector.id, shf: shift!.id, d: date! });
    return data as number | null;
  };
  let rates: Record<string, number | null> = {};
  if (step === 2) {
    const list = await Promise.all((posAll ?? []).map(async (x) => [x.id, await rateOf(x.id)] as const));
    rates = Object.fromEntries(list);
  }
  if (step >= 3 && position) rate = await rateOf(position.id);

  // elegíveis
  const eligible: { id: string; name: string }[] = [];
  let hiddenSusp = 0;
  if (step === 5 && position && date && reason) {
    const [{ data: en }, { data: susp }] = await Promise.all([
      ctx.sb.from("person_enablements").select("person_id").eq("position_id", position.id),
      ctx.sb.from("suspensions").select("person_id,ends_on").eq("house_id", ctx.house.id).is("lifted_at", null).lte("starts_on", date),
    ]);
    const enabled = new Set((en ?? []).map((r) => r.person_id));
    const suspended = new Set((susp ?? []).filter((s) => !s.ends_on || s.ends_on >= date).map((s) => s.person_id));
    for (const p of peopleAll ?? []) {
      if (reason.is_test ? p.kind !== "candidate" : p.kind === "candidate") continue;
      if (!reason.is_test && p.position_id !== position.id && !enabled.has(p.id)) continue;
      if (p.id === sp.ab) continue;
      if (suspended.has(p.id)) { hiddenSusp++; continue; }
      eligible.push({ id: p.id, name: p.name });
    }
  }

  return (
    <Page title="Nova vaga de extra" sub={sector.name} action={<Link href={`/extras?s=${sector.id}`} className="chip">Voltar</Link>}>
      <SectorPicker sectors={sectors} current={sector.id} base="/extras/nova" />
      <Flash msg={searchParams.erro} />

      {recap.length > 0 && (
        <ul className="card divide-y divide-stone-100 !p-0">
          {recap.map(([k, v, href]) => (
            <li key={k}>
              <Link href={href} className="flex min-h-[48px] items-center justify-between px-4 py-2">
                <span><span className="muted block">{k}</span><span className="font-semibold">{v}</span></span>
                <span className="text-sm font-semibold text-teal-700">alterar</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {step === 1 && (
        <form method="get" action="/extras/nova" className="card space-y-4">
          <input type="hidden" name="s" value={sector.id} />
          <div><label className="label">Dia do extra</label><input type="date" name="d" className="input" defaultValue={date ?? today()} min={today()} required /></div>
          <div>
            <label className="label">Turno</label>
            {(shifts ?? []).length === 0
              ? <p className="muted">Este setor não tem turnos cadastrados. Peça ao DP.</p>
              : <select name="sh" className="input" required defaultValue={sp.sh ?? ""}>
                  <option value="" disabled>Escolha o turno</option>
                  {(shifts ?? []).map((x) => <option key={x.id} value={x.id}>{x.name} · {hm(x.start_time)}–{hm(x.end_time)}</option>)}
                </select>}
          </div>
          <button className="btn" disabled={(shifts ?? []).length === 0}>Continuar</button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Qual cargo?</h2>
          {(posAll ?? []).map((x) => {
            const r = rates[x.id];
            return r == null ? (
              <div key={x.id} className="card flex min-h-[56px] items-center justify-between opacity-50">
                <span>{x.name}</span><span className="text-sm">sem valor</span>
              </div>
            ) : (
              <Link key={x.id} href={url(sp, { pos: x.id })} className="card flex min-h-[56px] items-center justify-between active:bg-stone-100">
                <span className="font-semibold">{x.name}</span><span className="font-bold text-teal-700">{brl(r)}</span>
              </Link>
            );
          })}
          {(posAll ?? []).length === 0 && <Empty>Nenhum cargo cadastrado. Peça ao DP.</Empty>}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Qual o motivo?</h2>
          {(reasons ?? []).map((x) => (
            <Link key={x.id} href={url(sp, { rs: x.id })} className="card flex min-h-[56px] items-center active:bg-stone-100 font-semibold">{x.name}</Link>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Quem faltou?</h2>
          {(peopleAll ?? []).filter((p) => p.kind !== "candidate").map((x) => (
            <Link key={x.id} href={url(sp, { ab: x.id })} className="card flex min-h-[56px] items-center active:bg-stone-100 font-semibold">{x.name}</Link>
          ))}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2">
          <h2 className="font-semibold">{reason?.is_test ? "Quem fará o teste?" : "Quem vai fazer o extra?"}</h2>
          {eligible.map((x) => (
            <Link key={x.id} href={url(sp, { p: x.id })} className="card flex min-h-[56px] items-center active:bg-stone-100 font-semibold">{x.name}</Link>
          ))}
          {eligible.length === 0 && (
            <Empty>
              Ninguém elegível para {position?.name}. {reason?.is_test ? "Cadastre o candidato na aba Equipe." : "Habilite pessoas para este cargo no cadastro delas."}
            </Empty>
          )}
          {hiddenSusp > 0 && <p className="muted">{hiddenSusp} pessoa(s) suspensa(s) não aparecem.</p>}
        </div>
      )}

      {step === 6 && position && (
        <form action={criar} className="space-y-4">
          {["s", "d", "sh", "pos", "rs", "ab", "p"].map((k) => <input key={k} type="hidden" name={k} value={(sp as any)[k] ?? ""} />)}
          <div className="card text-center">
            <p className="muted">Valor do extra</p>
            <p className="text-3xl font-bold text-teal-700">{rate == null ? "—" : brl(rate)}</p>
            {rate == null && <p className="mt-1 text-sm text-red-700">Sem valor definido para este cargo. Avise o DP.</p>}
          </div>
          <div>
            <label className="label">Observação{reason?.needs_note ? " (obrigatória)" : " (opcional)"}</label>
            <input name="note" className="input" required={!!reason?.needs_note} />
          </div>
          <button className="btn" disabled={rate == null}>Enviar ao DP</button>
        </form>
      )}
    </Page>
  );
}
