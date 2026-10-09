import Link from "next/link";
import { getCtx, getSectors } from "@/lib/ctx";
import { Empty, Flash, Page } from "@/components/ui";

const KIND: Record<string, string> = { employee: "Funcionário", freelancer: "Freelancer", candidate: "Candidato" };

type Row = { id: string; name: string; kind: string; cpf: string | null; sector_id: string; positions: { name: string } | null };

export default async function Equipe({ searchParams }: { searchParams: { s?: string; ver?: string; ok?: string; erro?: string } }) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  if (sectors.length === 0) return <Empty>Você ainda não tem setor. Fale com o Admin.</Empty>;

  const inactive = searchParams.ver === "inativos";
  const today = new Date().toISOString().slice(0, 10);
  // Setor é só filtro: sem filtro (ou "todos") mostra a equipe inteira
  const filter = sectors.find((s) => s.id === searchParams.s) ?? null;

  const [{ data, error }, { data: susp }] = await Promise.all([
    ctx.sb.from("people").select("id,name,kind,cpf,sector_id,positions!position_id(name)")
      .in("sector_id", sectors.map((s) => s.id)).eq("active", !inactive).order("name"),
    ctx.sb.from("suspensions").select("person_id,ends_on").eq("house_id", ctx.house.id).is("lifted_at", null).lte("starts_on", today),
  ]);
  const all = (data ?? []) as unknown as Row[];
  const people = filter ? all.filter((p) => p.sector_id === filter.id) : all;
  const count = new Map<string, number>();
  all.forEach((p) => count.set(p.sector_id, (count.get(p.sector_id) ?? 0) + 1));
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const suspended = new Set((susp ?? []).filter((s) => !s.ends_on || s.ends_on >= today).map((s) => s.person_id));
  const ver = inactive ? "&ver=inativos" : "";
  const novaHref = filter ? `/equipe/nova?s=${filter.id}` : "/equipe/nova";

  return (
    <Page title="Equipe" sub={filter ? filter.name : "Todos os setores"} action={<Link href={novaHref} className="chip chip-on">+ Pessoa</Link>}>
      <Flash msg={searchParams.ok} tone="ok" />
      <Flash msg={searchParams.erro ?? (error ? `Não foi possível carregar a equipe: ${error.message}` : undefined)} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Filtrar por setor">
        <Link href={`/equipe?${ver.slice(1)}`} className={`chip shrink-0 ${!filter ? "chip-on" : ""}`}>Todos <span className="ml-1.5 opacity-70">{all.length}</span></Link>
        {sectors.map((s) => (
          <Link key={s.id} href={`/equipe?s=${s.id}${ver}`} className={`chip shrink-0 ${filter?.id === s.id ? "chip-on" : ""}`}>
            {s.name} <span className="ml-1.5 opacity-70">{count.get(s.id) ?? 0}</span>
          </Link>
        ))}
      </div>
      <div className="flex gap-2">
        <Link href={`/equipe${filter ? `?s=${filter.id}` : ""}`} className={`chip ${!inactive ? "chip-on" : ""}`}>Ativos</Link>
        <Link href={`/equipe?${filter ? `s=${filter.id}&` : ""}ver=inativos`} className={`chip ${inactive ? "chip-on" : ""}`}>Inativos</Link>
      </div>

      {people.length === 0 && <Empty>Ninguém por aqui ainda. Toque em + Pessoa para cadastrar.</Empty>}
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/equipe/${p.id}`} className="card flex min-h-[64px] items-center justify-between transition-colors active:bg-stone-100">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="muted block truncate">
                  {p.positions?.name ?? "Sem cargo"} · {sectorName.get(p.sector_id)}{p.kind !== "employee" ? ` · ${KIND[p.kind]}` : ""}
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
