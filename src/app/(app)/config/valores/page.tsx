import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Empty, Flash, Page } from "@/components/ui";
import { back, refresh } from "@/lib/act";
import { brl, dmy, hm, today } from "@/lib/util";

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const amount = Number(String(formData.get("amount") ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || String(formData.get("amount")).trim() === "") back("/config/valores", "Informe um valor válido.");
  const { error } = await ctx.sb.from("pay_rates").insert({
    house_id: ctx.house.id,
    position_id: String(formData.get("position_id")),
    sector_id: String(formData.get("sector_id") ?? "") || null,
    shift_id: String(formData.get("shift_id") ?? "") || null,
    amount,
    valid_from: String(formData.get("valid_from") || today()),
    created_by: ctx.profile.id,
  });
  if (error) back("/config/valores", error.message);
  refresh("/config/valores");
  back("/config/valores", "Valor salvo.", "ok");
}

async function remover(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const { error } = await ctx.sb.from("pay_rates").delete().eq("id", String(formData.get("id")));
  if (error) back("/config/valores", error.message);
  refresh("/config/valores");
  back("/config/valores", "Linha removida.", "ok");
}

export default async function Valores({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const [{ data: positions }, { data: sectors }, { data: shifts }, { data: rates }] = await Promise.all([
    ctx.sb.from("positions").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name"),
    ctx.sb.from("sectors").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name"),
    ctx.sb.from("shifts").select("id,name,start_time,end_time,sector_id").eq("house_id", ctx.house.id).eq("active", true).order("start_time"),
    ctx.sb.from("pay_rates").select("*").eq("house_id", ctx.house.id).order("valid_from", { ascending: false }),
  ]);
  const pos = new Map((positions ?? []).map((p) => [p.id, p.name]));
  const sec = new Map((sectors ?? []).map((p) => [p.id, p.name]));
  const shf = new Map((shifts ?? []).map((p) => [p.id, p]));
  const byPos = new Map<string, typeof rates>();
  for (const r of rates ?? []) (byPos.get(r.position_id) ?? byPos.set(r.position_id, []).get(r.position_id)!)!.push(r);
  const missing = (positions ?? []).filter((p) => !byPos.has(p.id));

  return (
    <Page title="Valores dos extras" sub="Vale a linha mais específica (setor + turno)" action={<Link href="/config" className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      {missing.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
          Sem valor (não abrem vaga): <b>{missing.map((m) => m.name).join(", ")}</b>
        </div>
      )}
      <form action={criar} className="card space-y-3">
        <h2 className="font-semibold">Definir valor</h2>
        <div>
          <label className="label">Cargo</label>
          <select name="position_id" className="input" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {(positions ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Setor</label>
            <select name="sector_id" className="input" defaultValue="">
              <option value="">Todos</option>
              {(sectors ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Turno</label>
            <select name="shift_id" className="input" defaultValue="">
              <option value="">Todos</option>
              {(shifts ?? []).map((p) => <option key={p.id} value={p.id}>{sec.get(p.sector_id)} · {p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Valor (R$)</label><input name="amount" className="input" inputMode="decimal" placeholder="120,00" required /></div>
          <div><label className="label">Vale a partir de</label><input type="date" name="valid_from" className="input" defaultValue={today()} /></div>
        </div>
        <p className="muted">Se escolher um turno, o setor desse turno tem prioridade.</p>
        <button className="btn">Salvar valor</button>
      </form>

      {(rates ?? []).length === 0 && <Empty>Nenhum valor definido ainda.</Empty>}
      {Array.from(byPos.entries()).map(([pid, list]: [string, any]) => (
        <div key={pid} className="card">
          <h3 className="mb-1 font-semibold">{pos.get(pid) ?? "Cargo inativo"}</h3>
          <ul className="divide-y divide-stone-100">
            {list.map((r: any) => {
              const sh = r.shift_id ? shf.get(r.shift_id) : null;
              return (
                <li key={r.id} className="flex min-h-[52px] items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{r.sector_id ? sec.get(r.sector_id) : "Todos os setores"} · {sh ? `${sh.name} ${hm(sh.start_time)}` : "todos os turnos"}</div>
                    <div className="text-stone-500">desde {dmy(r.valid_from)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{brl(r.amount)}</span>
                    <form action={remover}><input type="hidden" name="id" value={r.id} /><button className="chip !px-3 text-red-700" aria-label="Remover">✕</button></form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Page>
  );
}
