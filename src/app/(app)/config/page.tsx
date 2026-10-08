import Link from "next/link";
import { requireDp } from "@/lib/ctx";
import { Page } from "@/components/ui";

const ITEMS = [
  ["/config/valores", "Valores dos extras", "Quanto cada cargo recebe por extra"],
  ["/config/cargos", "Cargos", "Criar, renomear e desativar"],
  ["/config/setores", "Setores", "Salão, Cozinha, Bar…"],
  ["/config/turnos", "Turnos", "Horários de cada setor"],
  ["/config/motivos", "Motivos de extra", "Lista usada ao abrir uma vaga"],
  ["/api/export", "Baixar Excel", "Extras aprovados do mês"],
];

export default async function Config() {
  await requireDp();
  return (
    <Page title="Configurações">
      <ul className="space-y-2">
        {ITEMS.map(([href, t, d]) => (
          <li key={href}>
            <Link href={href} prefetch={false} className="card flex min-h-[64px] items-center justify-between active:bg-stone-100">
              <span><span className="block font-semibold">{t}</span><span className="muted">{d}</span></span>
              <span className="text-stone-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
