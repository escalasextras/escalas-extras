import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back, refresh, delErr } from "@/lib/act";
import DeleteButton from "@/components/DeleteButton";

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("/config/motivos", "Informe o nome.");
  const { error } = await ctx.sb.from("extra_reasons").insert({
    house_id: ctx.house.id, name, needs_note: formData.get("needs_note") === "on",
  });
  if (error) back("/config/motivos", error.code === "23505" ? "Já existe esse motivo." : error.message);
  refresh("/config/motivos");
  back("/config/motivos", "Motivo criado.", "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const { error } = await ctx.sb.from("extra_reasons").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back("/config/motivos", error.message);
  refresh("/config/motivos");
  back("/config/motivos");
}

async function excluir(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const to = "/config/motivos";
  const { error } = await ctx.sb.from("extra_reasons").delete().eq("id", String(formData.get("id")));
  if (error) back(to, delErr(error));
  refresh("/config/motivos");
  back(to, "Motivo excluído.", "ok");
}

export default async function Motivos({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const { data } = await ctx.sb.from("extra_reasons").select("*").eq("house_id", ctx.house.id).order("active", { ascending: false }).order("name");
  return (
    <Page title="Motivos de extra" sub="Todo extra precisa de um motivo" action={<Link href="/config" className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card space-y-3">
        <input name="name" className="input" placeholder="Novo motivo" required />
        <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" name="needs_note" className="h-5 w-5 accent-teal-700" /> Exigir observação</label>
        <button className="btn">Criar motivo</button>
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((r) => (
          <li key={r.id} className={"card flex items-center justify-between gap-2 " + (r.active ? "" : "opacity-60")}>
            <div className="min-w-0">
              <div className="font-semibold">{r.name}</div>
              <div className="muted">{[r.needs_absent_person && "pede quem faltou", (r.needs_note || r.name === "Outro") && "exige observação", r.is_test && "teste"].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <form action={alternar}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value={r.active ? "0" : "1"} />
              <button className="chip shrink-0">{r.active ? "Desativar" : "Ativar"}</button>
            </form>
              <form action={excluir}>
                <input type="hidden" name="id" value={r.id} />
                <DeleteButton what="este motivo" />
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}
