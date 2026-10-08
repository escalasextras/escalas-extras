import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Empty, Flash, Page } from "@/components/ui";
import { back, refresh, delErr } from "@/lib/act";
import DeleteButton from "@/components/DeleteButton";

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("/config/setores", "Informe o nome.");
  const { error } = await ctx.sb.from("sectors").insert({ house_id: ctx.house.id, name });
  if (error) back("/config/setores", error.code === "23505" ? "Já existe com esse nome." : error.message);
  refresh("/config/setores");
  back("/config/setores", "Setor criado.", "ok");
}

async function renomear(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("/config/setores", "Informe o nome.");
  const { error } = await ctx.sb.from("sectors").update({ name }).eq("id", String(formData.get("id")));
  if (error) back("/config/setores", error.code === "23505" ? "Já existe com esse nome." : error.message);
  back("/config/setores", "Nome alterado.", "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const { error } = await ctx.sb.from("sectors").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back("/config/setores", error.message);
  refresh("/config/setores");
  back("/config/setores");
}

async function excluir(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const sid = String(formData.get("sid") ?? "");
  const to = `/config/setores${sid ? `?s=${sid}` : ""}`;
  const { error } = await ctx.sb.from("sectors").delete().eq("id", String(formData.get("id")));
  if (error) back(to, delErr(error));
  refresh("/config/setores");
  back(to, "Setor excluído.", "ok");
}

export default async function Page_({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const { data } = await ctx.sb.from("sectors").select("id,name,active").eq("house_id", ctx.house.id).order("active", { ascending: false }).order("name");
  return (
    <Page title="Setores" sub="Cada setor tem seus turnos e Líderes" action={<Link href="/config" className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card flex gap-2">
        <input name="name" className="input" placeholder="Novo: nome" required />
        <button className="btn !w-auto shrink-0">Criar</button>
      </form>
      {(data ?? []).length === 0 && <Empty>Nada cadastrado ainda.</Empty>}
      <ul className="space-y-2">
        {(data ?? []).map((r) => (
          <li key={r.id} className={"card flex flex-wrap items-center gap-2 " + (r.active ? "" : "opacity-60")}>
            <form action={renomear} className="flex min-w-0 flex-1 gap-2">
              <input type="hidden" name="id" value={r.id} />
              <input name="name" defaultValue={r.name} className="input !min-h-[44px]" />
              <button className="chip shrink-0">Salvar</button>
            </form>
            <form action={alternar}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value={r.active ? "0" : "1"} />
              <button className="chip shrink-0">{r.active ? "Desativar" : "Ativar"}</button>
            </form>
            <form action={excluir}>
              <input type="hidden" name="id" value={r.id} />
              <DeleteButton what="este setor" />
            </form>
          </li>
        ))}
      </ul>
    </Page>
  );
}
