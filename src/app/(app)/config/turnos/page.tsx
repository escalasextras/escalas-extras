import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Empty, Flash, Page, SectorFilter } from "@/components/ui";
import { back, refresh, delErr } from "@/lib/act";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "@/components/DeleteButton";
import { hm } from "@/lib/util";

async function criar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const f = String(formData.get("f") ?? "");
  const to = `/config/turnos${f ? `?s=${f}` : ""}`;
  const sector_id = String(formData.get("sector_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const start = String(formData.get("start")), end = String(formData.get("end"));
  if (!sector_id) back(to, "Escolha o setor.");
  if (!name || !start || !end) back(to, "Preencha nome, início e fim.");
  const { error } = await ctx.sb.from("shifts").insert({ house_id: ctx.house.id, sector_id, name, start_time: start, end_time: end });
  if (error) back(to, error.message);
  refresh("/config/turnos");
  back(to, "Turno criado.", "ok");
}

async function alternar(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const to = `/config/turnos${formData.get("f") ? `?s=${String(formData.get("f"))}` : ""}`;
  const { error } = await ctx.sb.from("shifts").update({ active: formData.get("to") === "1" }).eq("id", String(formData.get("id")));
  if (error) back(to, error.message);
  refresh("/config/turnos");
  back(to);
}

async function excluir(formData: FormData) {
  "use server";
  const ctx = await requireDp();
  const to = `/config/turnos${formData.get("f") ? `?s=${String(formData.get("f"))}` : ""}`;
  const { error } = await ctx.sb.from("shifts").delete().eq("id", String(formData.get("id")));
  if (error) back(to, delErr(error));
  refresh("/config/turnos");
  back(to, "Turno excluído.", "ok");
}

export default async function Turnos({ searchParams }: { searchParams: { s?: string; erro?: string; ok?: string } }) {
  const ctx = await requireDp();
  const { data: sectorRows } = await ctx.sb.from("sectors").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name");
  const sectors = sectorRows ?? [];
  if (sectors.length === 0) return <Page title="Turnos" action={<Link href="/config" className="chip">Voltar</Link>}><Empty>Crie um setor primeiro.</Empty></Page>;
  const filter = sectors.find((x) => x.id === searchParams.s) ?? null;
  const { data } = await ctx.sb.from("shifts").select("*").eq("house_id", ctx.house.id).order("active", { ascending: false }).order("start_time");
  const all = data ?? [];
  const list = filter ? all.filter((r) => r.sector_id === filter.id) : all;
  const by = new Map<string, number>();
  all.forEach((r) => by.set(r.sector_id, (by.get(r.sector_id) ?? 0) + 1));
  const sectorName = new Map(sectors.map((x) => [x.id, x.name]));
  const f = filter?.id ?? "";
  return (
    <Page title="Turnos" sub={filter?.name ?? "Todos os setores"} action={<Link href="/config" className="chip">Voltar</Link>}>
      <SectorFilter sectors={sectors} current={filter?.id} base="/config/turnos" counts={{ all: all.length, by }} />
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={criar} className="card space-y-3">
        <input type="hidden" name="f" value={f} />
        <div>
          <label className="label">Setor</label>
          <select name="sector_id" className="input" required defaultValue={filter?.id ?? (sectors.length === 1 ? sectors[0].id : "")}>
            <option value="" disabled>Escolha o setor</option>
            {sectors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <input name="name" className="input" placeholder="Nome (ex.: Jantar)" required />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Início</label><input type="time" name="start" className="input" required /></div>
          <div><label className="label">Fim</label><input type="time" name="end" className="input" required /></div>
        </div>
        <SubmitButton>Criar turno</SubmitButton>
      </form>
      {list.length === 0 && <Empty>Nenhum turno por aqui ainda.</Empty>}
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className={"card flex items-center justify-between gap-2 " + (r.active ? "" : "opacity-60")}>
            <div className="min-w-0"><div className="truncate font-semibold">{r.name}</div><div className="muted truncate">{sectorName.get(r.sector_id)} · {hm(r.start_time)} às {hm(r.end_time)}</div></div>
            <div className="flex shrink-0 gap-2">
              <form action={alternar}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="f" value={f} /><input type="hidden" name="to" value={r.active ? "0" : "1"} />
                <button className="chip">{r.active ? "Desativar" : "Ativar"}</button>
              </form>
              <form action={excluir}>
                <input type="hidden" name="id" value={r.id} /><input type="hidden" name="f" value={f} />
                <DeleteButton what="este turno" />
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}
