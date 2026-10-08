import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/ctx";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getUser();
  if (profile.role !== "admin") redirect("/");
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-10">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-stone-200 bg-stone-50/95 px-4 py-3 backdrop-blur">
        <Link href="/admin" className="font-bold">Administração</Link>
        <nav className="flex gap-2">
          <Link href="/admin/casas" className="chip">Casas</Link>
          <Link href="/admin/usuarios" className="chip">Usuários</Link>
          <Link href="/casas" className="chip">Sair</Link>
        </nav>
      </header>
      <div className="py-4">{children}</div>
    </div>
  );
}
