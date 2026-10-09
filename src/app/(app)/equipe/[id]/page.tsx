import Link from "next/link";
import { notFound } from "next/navigation";
import { getCtx, getSectors } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back, refresh, delErr } from "@/lib/act";
import { redirect } from "next/navigation";
import DeleteButton from "@/components/DeleteButton";
import { dmy, fmtCpf, maskCpf, onlyDigits, today } from "@/lib/util";

async function salvar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const id = String(formData.get("id"));
  const cpf = onlyDigits(String(formData.get("cpf") ?? ""));
  if (cpf && cpf.length !== 11) back(`/equipe/${id}`, "CPF deve ter 11 números.");
  const patch: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    position_id: String(formData.get("position_id") ?? "") || null,
    ...(formData.get("sector_id") ? { sector_id: String(formData.get("sector_id")) } : {}),
    phone: String(formData.get("phone") ?? "").trim() || null,
    pix: String(formData.get("pix") ?? "").trim() || null,
  };
  if (formData.has("cpf")) patch.cpf = cpf || null;
  const { error } = await ctx.sb.from("people").update(patch).eq("id", id);
  if (error) back(`/equipe/${id}`, error.message);
  refresh("/equipe");
  back(`/equipe/${id}`, "Dados salvos.", "ok");
}

async function habilitar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const id = String(formData.get("id"));
  const want = new Set(formData.getAll("pos").map(String));
  const { data: cur } = await ctx.sb.from("person_enablements").select("position_id").eq("person_id", id);
  const have = new Set((cur ?? []).map((r) => r.position_id));
  const add = [...want].filter((p) => !have.has(p));
  const del = [...have].filter((p) => !want.has(p));
  if (add.length) {
    const { error } = await ctx.sb.from("person_enablements").insert(add.map((position_id) => ({ person_id: id, position_id, enabled_by: ctx.profile.id })));
    if (error) back(`/equipe/${id}`, error.message);
  }
  if (del.length) {
    const { error } = await ctx.sb.from("person_enablements").delete().eq("person_id", id).in("position_id", del);
    if (error) back(`/equipe/${id}`, error.message);
  }
  back(`/equipe/${id}`, "Habilitações salvas.", "ok");
}

async function suspender(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) back(`/equipe/${id}`, "Informe o motivo da suspensão.");
  const days = String(formData.get("days"));
  const ends = days === "x" ? null : new Date(Date.now() + Number(days) * 86400000 - 3 * 3600000).toISOString().slice(0, 10);
  const { error } = await ctx.sb.from("suspensions").insert({
    house_id: ctx.house.id, person_id: id, starts_on: today(), ends_on: ends, reason, created_by: ctx.profile.id,
  });
  if (error) back(`/equipe/${id}`, error.message);
  back(`/equipe/${id}`, "Pessoa suspensa de extras.", "ok");
}

async function reativar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const id = String(formData.get("id"));
  const { error } = await ctx.sb.from("suspensions").update({ lifted_at: new Date().toISOString(), lifted_by: ctx.profile.id }).eq("id", String(formData.get("sid")));
  if (error) back(`/equipe/${id}`, error.message);
  back(`/equipe/${id}`, "Suspensão encerrada.", "ok");
}

async function ativar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const id = String(formData.get("id"));
  const { error } = await ctx.sb.from("people").update({ active: formData.get("to") === "1" }).eq("id", id);
  if (error) back(`/equipe/${id}`, error.message);
  refresh("/equipe");
  back(`/equipe/${id}`, formData.get("to") === "1" ? "Pessoa reativada." : "Pessoa inativada.", "ok");
}

async function excluir(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  if (!ctx.isDp) back("/equipe", "Só Gestor ou DP exclui pessoas.");
  const id = String(formData.get("id"));
  const { error } = await ctx.sb.from("people").delete().eq("id", id);
  if (error) back(`/equipe/${id}`, delErr(error).replace("Use Desativar", "Use Inativar pessoa"));
  refresh("/equipe");
  redirect("/equipe");
}

export default async function Pessoa({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string; ok?: string } }) {
  const ctx = await getCtx();
  const { data: p } = await ctx.sb.from("people").select("*, sectors(name)").eq("id", params.id).single();
  if (!p || p.house_id !== ctx.house.id) notFound();
  const [{ data: positions }, { data: enabled }, { data: susps }, { count: faltas }] = await Promise.all([
    ctx.sb.from("positions").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name"),
    ctx.sb.from("person_enablements").select("position_id").eq("person_id", p.id),
    ctx.sb.from("suspensions").select("*").eq("person_id", p.id).order("created_at", { ascending: false }),
    ctx.sb.from("extra_requests").select("id", { count: "exact", head: true }).eq("person_id", p.id).eq("attendance", "absent"),
  ]);
  const sectorList = await getSectors(ctx);
  const on = new Set((enabled ?? []).map((e) => e.position_id));
  const t = today();
  const ativa = (susps ?? []).find((s) => !s.lifted_at && s.starts_on <= t && (!s.ends_on || s.ends_on >= t));

  return (
    <Page title={p.name} sub={`${(p as any).sectors?.name} · ${p.active ? "Ativo" : "Inativo"}`}
      action={<Link href="/equipe" className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} />
      <Flash msg={searchParams.ok} tone="ok" />

      {ativa && (
        <div className="card border-red-200 bg-red-50">
          <p className="font-semibold text-red-800">Suspenso de extras</p>
          <p className="text-sm text-red-700">{ativa.ends_on ? `até ${dmy(ativa.ends_on)}` : "por tempo indeterminado"} · {ativa.reason}</p>
          <form action={reativar} className="mt-3">
            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="sid" value={ativa.id} />
            <button className="btn-ghost btn-sm">Reativar para extras</button>
          </form>
        </div>
      )}

      <form action={salvar} className="card space-y-3">
        <input type="hidden" name="id" value={p.id} />
        <div><label className="label">Nome</label><input name="name" className="input" defaultValue={p.name} required /></div>
        <div>
          <label className="label">Setor</label>
          <select name="sector_id" className="input" defaultValue={p.sector_id}>
            {sectorList.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Cargo</label>
          <select name="position_id" className="input" defaultValue={p.position_id ?? ""}>
            <option value="">Sem cargo</option>
            {(positions ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        {ctx.isDp
          ? <div><label className="label">CPF</label><input name="cpf" className="input" inputMode="numeric" defaultValue={fmtCpf(p.cpf)} /></div>
          : <div><label className="label">CPF</label><p className="input flex items-center bg-stone-100 text-stone-500">{maskCpf(p.cpf)}</p></div>}
        <div><label className="label">Telefone</label><input name="phone" className="input" inputMode="tel" defaultValue={p.phone ?? ""} /></div>
        <div><label className="label">Chave PIX</label><input name="pix" className="input" defaultValue={p.pix ?? ""} /></div>
        <button className="btn">Salvar dados</button>
      </form>

      <form action={habilitar} className="card space-y-3">
        <input type="hidden" name="id" value={p.id} />
        <div>
          <h2 className="font-semibold">Cargos habilitados para extra</h2>
          <p className="muted">Só aparece nas vagas dos cargos marcados (e do cargo atual).</p>
        </div>
        <div className="space-y-1">
          {(positions ?? []).map((x) => (
            <label key={x.id} className="flex min-h-[44px] items-center gap-3 rounded-lg px-1 active:bg-stone-100">
              <input type="checkbox" name="pos" value={x.id} defaultChecked={on.has(x.id)} className="h-5 w-5 accent-teal-700" />
              <span>{x.name}</span>
            </label>
          ))}
        </div>
        <button className="btn-ghost">Salvar habilitações</button>
      </form>

      {!ativa && (
        <details className="card">
          <summary className="min-h-[44px] cursor-pointer font-semibold leading-[44px]">Suspender de extras</summary>
          <form action={suspender} className="mt-2 space-y-3">
            <input type="hidden" name="id" value={p.id} />
            <div>
              <label className="label">Por quanto tempo</label>
              <select name="days" className="input" defaultValue="15">
                <option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option>
                <option value="60">60 dias</option><option value="90">90 dias</option><option value="x">Indeterminado</option>
              </select>
            </div>
            <div><label className="label">Motivo</label><input name="reason" className="input" required /></div>
            <button className="btn-danger">Suspender</button>
          </form>
        </details>
      )}

      <div className="card">
        <h2 className="font-semibold">Histórico</h2>
        <p className="muted">{faltas ?? 0} falta(s) em extras.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {(susps ?? []).map((s) => (
            <li key={s.id} className="text-stone-600">
              {dmy(s.starts_on)} → {s.ends_on ? dmy(s.ends_on) : "indeterminado"} · {s.reason}{s.lifted_at ? " (encerrada)" : ""}
            </li>
          ))}
          {(susps ?? []).length === 0 && <li className="text-stone-400">Sem suspensões.</li>}
        </ul>
      </div>

      <form action={ativar}>
        <input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value={p.active ? "0" : "1"} />
        <button className={p.active ? "btn-danger" : "btn-ghost"}>{p.active ? "Inativar pessoa" : "Reativar pessoa"}</button>
      </form>

      {ctx.isDp && (
        <form action={excluir}>
          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="sid" value={p.sector_id} />
          <DeleteButton what="esta pessoa" />
        </form>
      )}
    </Page>
  );
}
