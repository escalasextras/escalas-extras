import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Empty, Flash, Page, SectorFilter } from "@/components/ui";
import { back, refresh, delErr } from "@/lib/act";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";

const SUGERIDOS = ["Etiquetas e validades", "Limpeza do setor", "Organização da bancada/estação", "Equipamentos funcionando", "Uniforme e higiene da equipe", "Reposição e mise en place"];
const to = (f: string) => `/config/checklist${f ? `?s=${f}` : ""}`;

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const f = String(formData.get("f") ?? "");
  const sector_id = String(formData.get("sector_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!sector_id) back(to(f), "Escolha o setor.");
  if (!name) back(to(f), "Informe o item.");
  const { error } = await ctx.sb.from("checklist_items").insert({ house_id: ctx.house.id, sector_id, name, sort: Date.now() % 100000000 });
  if (error) back(to(f), error.message);
  refresh("/config/checklist", "/checklist");
  back(to(f), "Item criado.", "ok");
}

async function sugeridos(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const f = String(formData.get("f") ?? "");
  const sector_id = String(formData.get("sector_id") ?? "");
  if (!sector_id) back(to(f), "Escolha o setor para criar os itens sugeridos.");
  const { data: have } = await ctx.sb.from("checklist_items").select("name").eq("sector_id", sector_id);
  const names = new Set((have ?? []).map((h) => h.name.toLowerCase()));
  const rows = SUGERIDOS.filter((n) => !names.has(n.toLowerCase())).map((name, i) => ({ house_id: ctx.house.id, sector_id, name, sort: i }));
  if (rows.length) {
    const { error } = await ctx.sb.from("checklist_items").insert(rows);
    if (error) back(to(f), error.message);
  }
  refresh("/config/checklist", "/checklist");
  back(to(f), `${rows.length} item(ns) sugerido(s) criado(s).`, "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const f = String(formData.get("f") ?? "");
  const { error } = await ctx.sb.from("checklist_items").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back(to(f), error.message);
  refresh("/config/checklist", "/checklist");
  back(to(f));
}

async function excluir(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const f = String(formData.get("f") ?? "");
  const { error } = await ctx.sb.from("checklist_items").delete().eq("id", String(formData.get("id")));
  if (error) back(to(f), delErr(error));
  refresh("/config/checklist", "/checklist");
  back(to(f), "Item excluído.", "ok");
}

export default async function ConfigChecklist({ searchParams }: { searchParams: { s?: string; erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const { data: sectorRows } = await ctx.sb.from("sectors").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name");
  const sectors = sectorRows ?? [];
  if (sectors.length === 0) return <Page title="Checklist" action={<Link href="/config" className="chip">Voltar</Link>}><Empty>Crie um setor primeiro.</Empty></Page>;
  const filter = sectors.find((x) => x.id === searchParams.s) ?? null;
  const { data } = await ctx.sb.from("checklist_items").select("*").eq("house_id", ctx.house.id).order("active", { ascending: false }).order("sort").order("name");
  const all = data ?? [];
  const list = filter ? all.filter((r) => r.sector_id === filter.id) : all;
  const by = new Map<string, number>();
  all.forEach((r) => by.set(r.sector_id, (by.get(r.sector_id) ?? 0) + 1));
  const sectorName = new Map(sectors.map((x) => [x.id, x.name]));
  const f = filter?.id ?? "";
  const def = filter?.id ?? (sectors.length === 1 ? sectors[0].id : "");
  return (
    <Page title="Itens do checklist" sub={filter?.name ?? "Todos os setores"} action={<Link href="/config" className="chip">Voltar</Link>}>
      <SectorFilter sectors={sectors} current={filter?.id} base="/config/checklist" counts={{ all: all.length, by }} />
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card space-y-3">
        <input type="hidden" name="f" value={f} />
        <div>
          <label className="label">Setor</label>
          <select name="sector_id" className="input" required defaultValue={def}>
            <option value="" disabled>Escolha o setor</option>
            {sectors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <input name="name" className="input" placeholder="Item (ex.: Etiquetas em dia)" required />
        <SubmitButton>Adicionar item</SubmitButton>
      </form>
      <form action={sugeridos} className="card space-y-2">
        <input type="hidden" name="f" value={f} /><input type="hidden" name="sector_id" value={def} />
        <p className="muted">{def ? "Cria itens comuns (etiquetas, limpeza, organização…) no setor selecionado." : "Selecione um setor no filtro para criar os itens sugeridos."}</p>
        <button className="btn-ghost" disabled={!def}>Criar itens sugeridos</button>
      </form>
      {list.length === 0 && <Empty>Nenhum item por aqui ainda.</Empty>}
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className={"card flex items-center justify-between gap-2 " + (r.active ? "" : "opacity-60")}>
            <div className="min-w-0"><div className="truncate font-semibold">{r.name}</div><div className="muted truncate">{sectorName.get(r.sector_id)}</div></div>
            <div className="flex shrink-0 gap-2">
              <form action={alternar}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="f" value={f} /><input type="hidden" name="to" value={r.active ? "0" : "1"} />
                <button className="chip">{r.active ? "Desativar" : "Ativar"}</button>
              </form>
              <form action={excluir}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="f" value={f} />
                <DeleteButton what="este item" />
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}
