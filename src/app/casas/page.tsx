import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/ctx";
import { supabaseServer } from "@/lib/supabase/server";

async function escolher(formData: FormData) {
  "use server";
  cookies().set("house_id", String(formData.get("id")), { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax" });
  redirect("/");
}

async function sair() {
  "use server";
  await supabaseServer().auth.signOut();
  cookies().delete("house_id");
  redirect("/login");
}

export default async function Casas() {
  const { sb, profile } = await getUser();
  const { data: houses } = await sb.from("houses").select("id,name,company").eq("active", true).order("name");
  const list = houses ?? [];
  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <p className="muted">Olá, {profile.full_name.split(" ")[0]}</p>
      <h1 className="h1 mb-6 mt-1 text-3xl">Escolha a casa</h1>
      {list.length === 0 && (
        <p className="card muted">Você ainda não tem acesso a nenhuma casa. Fale com o Admin.</p>
      )}
      <div className="space-y-3">
        {list.map((h) => (
          <form key={h.id} action={escolher}>
            <input type="hidden" name="id" value={h.id} />
            <button className="card flex w-full min-h-[72px] items-center justify-between text-left transition-colors active:bg-stone-100">
              <span>
                <span className="block font-display text-lg font-bold">{h.name}</span>
                {h.company && <span className="muted">{h.company}</span>}
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500" aria-hidden="true">›</span>
            </button>
          </form>
        ))}
      </div>
      <div className="mt-8 space-y-3">
        {profile.role === "admin" && <Link href="/admin" className="btn-ghost">Administração</Link>}
        <Link href="/conta" className="btn-ghost">Trocar minha senha</Link>
        <form action={sair}><button className="btn-ghost">Sair</button></form>
      </div>
    </main>
  );
}
