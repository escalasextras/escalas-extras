import { redirect } from "next/navigation";
import { getCtx, getSectors, pickSector } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back, refresh } from "@/lib/act";
import SubmitButton from "@/components/SubmitButton";
import { onlyDigits } from "@/lib/util";

async function criar(formData: FormData) {
  "use server";
  const ctx = await getCtx();
  const sector_id = String(formData.get("sector_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back(`/equipe/nova?s=${sector_id}`, "Informe o nome.");
  const cpf = onlyDigits(String(formData.get("cpf") ?? ""));
  if (cpf && cpf.length !== 11) back(`/equipe/nova?s=${sector_id}`, "CPF deve ter 11 números.");
  const kind = String(formData.get("kind") ?? "employee");
  const position_id = String(formData.get("position_id") ?? "");
  if (!position_id) back(`/equipe/nova?s=${sector_id}`, "Escolha o cargo.");
  const { error } = await ctx.sb.from("people").insert({
    house_id: ctx.house.id,
    sector_id,
    name,
    kind,
    position_id,
    cpf: cpf || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    pix: String(formData.get("pix") ?? "").trim() || null,
  });
  if (error) back(`/equipe/nova?s=${sector_id}`, error.message);
  refresh("/equipe");
  back(`/equipe?s=${sector_id}`, `${name} salvo(a).`, "ok");
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
        <div><label className="label">Nome</label><input name="name" className="input" required autoComplete="off" /></div>
        <div>
          <label className="label">Cargo</label>
          <select name="position_id" className="input" defaultValue="" required>
            <option value="" disabled>Escolha o cargo</option>
            {(positions ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(positions ?? []).length === 0 && <p className="mt-1 text-sm text-stone-500">Nenhum cargo cadastrado ainda. Cadastre em Config → Cargos.</p>}
        </div>
        <details className="rounded-xl border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-600">Mais dados (opcional)</summary>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label">Tipo</label>
              <select name="kind" className="input" defaultValue="employee">
                <option value="employee">Funcionário</option>
                <option value="freelancer">Freelancer</option>
                <option value="candidate">Candidato (teste)</option>
              </select>
            </div>
            <div><label className="label">CPF</label><input name="cpf" className="input" inputMode="numeric" placeholder="somente números" /></div>
            <div><label className="label">Telefone</label><input name="phone" className="input" inputMode="tel" /></div>
            <div><label className="label">Chave PIX</label><input name="pix" className="input" autoCapitalize="none" /></div>
          </div>
        </details>
        <SubmitButton>Salvar</SubmitButton>
      </form>
    </Page>
  );
}
