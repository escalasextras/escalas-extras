import Link from "next/link";
import { getCtx, getSectors, pickSector } from "@/lib/ctx";
import { Empty, Page, SectorPicker } from "@/components/ui";
import { maskCpf } from "@/lib/util";

const KIND: Record<string, string> = { employee: "Funcionário", freelancer: "Freelancer", candidate: "Candidato" };

export default async function Equipe({ searchParams }: { searchParams: { s?: string; ver?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  const sector = pickSector(sectors, searchParams.s);
  if (!sector) return <Empty>Você ainda não tem setor. Fale com o Admin.</Empty>;
  const inactive = searchParams.ver === "inativos";
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: people }, { data: susp }] = await Promise.all([
    ctx.sb.from("people").select("id,name,kind,cpf,active,positions(name)").eq("sector_id", sector.id).eq("active", !inactive).order("name"),
    ctx.sb.from("suspensions").select("person_id,ends_on").eq("house_id", ctx.house.id).is("lifted_at", null).lte("starts_on", today),
  ]);
  const suspended = new Set((susp ?? []).filter((s) => !s.ends_on || s.ends_on >= today).map((s) => s.person_id));

  return (
    <Page title="Equipe" sub={sector.name} action={<Link href={`/equipe/nova?s=${sector.id}`} className="chip chip-on">+ Pessoa</Link>}>
      <SectorPicker sectors={sectors} current={sector.id} base="/equipe" />
      <div className="flex gap-2">
        <Link href={`/equipe?s=${sector.id}`} className={`chip ${!inactive ? "chip-on" : ""}`}>Ativos</Link>
        <Link href={`/equipe?s=${sector.id}&ver=inativos`} className={`chip ${inactive ? "chip-on" : ""}`}>Inativos</Link>
      </div>
      {(people ?? []).length === 0 && <Empty>Ninguém por aqui ainda.</Empty>}
      <ul className="space-y-2">
        {(people ?? []).map((p: any) => (
          <li key={p.id}>
            <Link href={`/equipe/${p.id}`} className="card flex min-h-[64px] items-center justify-between active:bg-stone-100">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="muted block truncate">
                  {p.positions?.name ?? "Sem cargo"} · {KIND[p.kind]} · {ctx.isDp ? p.cpf ?? "—" : maskCpf(p.cpf)}
                </span>
              </span>
              {suspended.has(p.id) && <span className="badge ml-2 shrink-0 bg-red-100 text-red-700">Suspenso</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
