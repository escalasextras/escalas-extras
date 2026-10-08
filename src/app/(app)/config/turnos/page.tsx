import Link from "next/link";
import { requireDp, pickSector } from "@/lib/ctx";
import { Empty, Flash, Page, SectorPicker } from "@/components/ui";
import { back, refresh, delErr } from "@/lib/act";
import DeleteButton from "@/components/DeleteButton";
import { hm } from "@/lib/util";

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const s = String(formData.get("s"));
  const name = String(formData.get("name") ?? "").trim();
  const start = String(formData.get("start")), end = String(formData.get("end"));
  if (!name || !start || !end) back(`/config/turnos?s=${s}`, "Preencha nome, início e fim.");
  const { error } = await ctx.sb.from("shifts").insert({ house_id: ctx.house.id, sector_id: s, name, start_time: start, end_time: end });
  if (error) back(`/config/turnos?s=${s}`, error.message);
  refresh("/config/turnos");
  back(`/config/turnos?s=${s}`, "Turno criado.", "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const s = String(formData.get("s"));
  const { error } = await ctx.sb.from("shifts").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back(`/config/turnos?s=${s}`, error.message);
  refresh("/config/turnos");
  back(`/config/turnos?s=${s}`);
}

async function excluir(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const to = `/config/turnos?s=${String(formData.get("s"))}`;
  const { error } = await ctx.sb.from("shifts").delete().eq("id", String(formData.get("id")));
  if (error) back(to, delErr(error));
  refresh("/config/turnos");
  back(to, "Turno excluído.", "ok");
}

export default async function Turnos({ searchParams }: { searchParams: { s?: string; erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const { data: sectors } = await ctx.sb.from("sectors").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name");
  const sector = pickSector(sectors ?? [], searchParams.s);
  if (!sector) return <Page title="Turnos" action={<Link href="/config" className="chip">Voltar</Link>}><Empty>Crie um setor primeiro.</Empty></Page>;
  const { data } = await ctx.sb.from("shifts").select("*").eq("sector_id", sector.id).order("active", { ascending: false }).order("start_time");
  return (
    <Page title="Turnos" sub={sector.name} action={<Link href="/config" className="chip">Voltar</Link>}>
      <SectorPicker sectors={sectors ?? []} current={sector.id} base="/config/turnos" />
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card space-y-3">
        <input type="hidden" name="s" value={sector.id} />
        <input name="name" className="input" placeholder="Nome (ex.: Jantar)" required />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Início</label><input type="time" name="start" className="input" required /></div>
          <div><label className="label">Fim</label><input type="time" name="end" className="input" required /></div>
        </div>
        <button className="btn">Criar turno</button>
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((r) => (
          <li key={r.id} className={"card flex items-center justify-between gap-2 " + (r.active ? "" : "opacity-60")}>
            <div><div className="font-semibold">{r.name}</div><div className="muted">{hm(r.start_time)} às {hm(r.end_time)}</div></div>
            <div className="flex shrink-0 gap-2">
              <form action={alternar}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="s" value={sector.id} /><input type="hidden" name="to" value={r.active ? "0" : "1"} />
              <button className="chip">{r.active ? "Desativar" : "Ativar"}</button>
            </form>
              <form action={excluir}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="s" value={sector.id} />
                <DeleteButton what="este turno" />
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}
