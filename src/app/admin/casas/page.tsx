import { getUser } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back, refresh } from "@/lib/act";

async function criar(formData: FormData) {
  "use server";
  const { sb } = await getUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("/admin/casas", "Informe o nome da casa.");
  const { error } = await sb.from("houses").insert({ name, company: String(formData.get("company") ?? "").trim() || null });
  if (error) back("/admin/casas", error.message);
  refresh("/admin/casas");
  back("/admin/casas", "Casa criada com os motivos padrão.", "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const { sb } = await getUser();
  const { error } = await sb.from("houses").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back("/admin/casas", error.message);
  refresh("/admin/casas");
  back("/admin/casas");
}

export default async function Casas({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const { sb } = await getUser();
  const { data } = await sb.from("houses").select("*").order("active", { ascending: false }).order("name");
  return (
    <Page title="Casas" sub="Cada casa é isolada das outras">
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card space-y-3">
        <input name="name" className="input" placeholder="Nome da casa" required />
        <input name="company" className="input" placeholder="Empresa / CNPJ (opcional)" />
        <button className="btn">Criar casa</button>
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((h) => (
          <li key={h.id} className={"card flex items-center justify-between gap-2 " + (h.active ? "" : "opacity-60")}>
            <div className="min-w-0"><div className="truncate font-semibold">{h.name}</div>{h.company && <div className="muted truncate">{h.company}</div>}</div>
            <form action={alternar}>
              <input type="hidden" name="id" value={h.id} /><input type="hidden" name="to" value={h.active ? "0" : "1"} />
              <button className="chip">{h.active ? "Desativar" : "Ativar"}</button>
            </form>
          </li>
        ))}
      </ul>
    </Page>
  );
}
