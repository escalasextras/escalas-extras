import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Empty, Flash, Page } from "@/components/ui";
import { back, refresh } from "@/lib/act";

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("/config/cargos", "Informe o nome.");
  const { error } = await ctx.sb.from("positions").insert({ house_id: ctx.house.id, name });
  if (error) back("/config/cargos", error.code === "23505" ? "Já existe com esse nome." : error.message);
  refresh("/config/cargos");
  back("/config/cargos", "Cargo criado.", "ok");
}

async function renomear(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("/config/cargos", "Informe o nome.");
  const { error } = await ctx.sb.from("positions").update({ name }).eq("id", String(formData.get("id")));
  if (error) back("/config/cargos", error.code === "23505" ? "Já existe com esse nome." : error.message);
  back("/config/cargos", "Nome alterado.", "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const { error } = await ctx.sb.from("positions").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back("/config/cargos", error.message);
  refresh("/config/cargos");
  back("/config/cargos");
}

export default async function Page_({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const { data } = await ctx.sb.from("positions").select("id,name,active").eq("house_id", ctx.house.id).order("active", { ascending: false }).order("name");
  return (
    <Page title="Cargos" sub="Cargo novo só abre vaga depois que tiver valor" action={<Link href="/config" className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card flex gap-2">
        <input name="name" className="input" placeholder="Novo: nome" required />
        <button className="btn !w-auto shrink-0">Criar</button>
      </form>
      {(data ?? []).length === 0 && <Empty>Nada cadastrado ainda.</Empty>}
      <ul className="space-y-2">
        {(data ?? []).map((r) => (
          <li key={r.id} className={"card flex items-center gap-2 " + (r.active ? "" : "opacity-60")}>
            <form action={renomear} className="flex min-w-0 flex-1 gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="name" defaultValue={r.name} className="input !min-h-[44px]" />
              <button className="chip shrink-0">Salvar</button>
            </form>
            <form action={alternar}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value={r.active ? "0" : "1"} />
              <button className="chip shrink-0">{r.active ? "Desativar" : "Ativar"}</button>
            </form>
          </li>
        ))}
      </ul>
    </Page>
  );
}
