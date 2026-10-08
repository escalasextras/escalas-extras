import Link from "next/link";
import { getUser } from "@/lib/ctx";
import { Page } from "@/components/ui";

export default async function Admin() {
  const { sb } = await getUser();
  const [{ count: casas }, { count: users }] = await Promise.all([
    sb.from("houses").select("id", { count: "exact", head: true }),
    sb.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  return (
    <Page title="Administração" sub="Casas, usuários e acessos">
      <Link href="/admin/casas" className="card flex min-h-[64px] items-center justify-between"><span><b className="block">Casas</b><span className="muted">{casas ?? 0} cadastradas</span></span><span className="text-stone-400">›</span></Link>
      <Link href="/admin/usuarios" className="card flex min-h-[64px] items-center justify-between"><span><b className="block">Usuários</b><span className="muted">{users ?? 0} cadastrados</span></span><span className="text-stone-400">›</span></Link>
      <Link href="/casas" className="btn-ghost">Entrar em uma casa</Link>
    </Page>
  );
}
