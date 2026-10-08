import { redirect } from "next/navigation";
import { getCtx, getSectors, pickSector } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back } from "@/lib/act";
import { onlyDigits } from "@/lib/util";

async function criar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const sector_id = String(formData.get("sector_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(`/equipe/nova?s=${sector_id}`, "Informe o nome.");
  const cpf = onlyDigits(String(formData.get("cpf") ?? ""));
  if (cpf && cpf.length !== 11) back(`/equipe/nova?s=${sector_id}`, "CPF deve ter 11 números.");
  const kind = String(formData.get("kind"));
  if ((kind === "freelancer" || kind === "candidate") && !cpf) back(`/equipe/nova?s=${sector_id}`, "CPF é obrigatório para freelancer e candidato.");
  const { error } = await ctx.sb.from("people").insert({
    house_id: ctx.house.id,
    sector_id,
    name,
    kind,
    position_id: String(formData.get("position_id") ?? "") || null,
    cpf: cpf || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    pix: String(formData.get("pix") ?? "").trim() || null,
  });
  if (error) back(`/equipe/nova?s=${sector_id}`, error.message);
  redirect(`/equipe?s=${sector_id}`);
}

export default async function Nova({ searchParams }: { searchParams: { s?: string; erro?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  const sector = pickSector(sectors, searchParams.s);
  if (!sector) redirect("/equipe");
  const { data: positions } = await ctx.sb.from("positions").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name");
  return (
    <Page title="Nova pessoa" sub={sector.name}>
      <Flash msg={searchParams.erro} />
      <form action={criar} className="space-y-4">
        <input type="hidden" name="sector_id" value={sector.id} />
        <div><label className="label">Nome completo</label><input name="name" className="input" required autoComplete="off" /></div>
        <div>
          <label className="label">Tipo</label>
          <select name="kind" className="input" defaultValue="employee">
            <option value="employee">Funcionário</option>
            <option value="freelancer">Freelancer</option>
            <option value="candidate">Candidato (teste)</option>
          </select>
        </div>
        <div>
          <label className="label">Cargo</label>
          <select name="position_id" className="input" defaultValue="">
            <option value="">Sem cargo</option>
            {(positions ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label">CPF</label><input name="cpf" className="input" inputMode="numeric" placeholder="somente números" /></div>
        <div><label className="label">Telefone</label><input name="phone" className="input" inputMode="tel" /></div>
        <div><label className="label">Chave PIX</label><input name="pix" className="input" autoCapitalize="none" /></div>
        <button className="btn">Salvar</button>
      </form>
    </Page>
  );
}
