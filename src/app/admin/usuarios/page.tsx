import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back } from "@/lib/act";
import { supabaseAdmin, usernameToEmail } from "@/lib/supabase/admin";
import { ROLE_LABEL } from "@/lib/util";

async function criar(formData: FormData) {
  "use server";
  const { profile } = await getUser();
  if (profile.role !== "admin") redirect("/");
  const username = String(formData.get("username") ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const full_name = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role"));
  if (!username || !full_name) back("/admin/usuarios", "Informe nome e usuário.");
  if (password.length < 6) back("/admin/usuarios", "A senha precisa ter pelo menos 6 caracteres.");
  const adm = supabaseAdmin();
  const { data, error } = await adm.auth.admin.createUser({ email: usernameToEmail(username), password, email_confirm: true });
  if (error || !data.user) back("/admin/usuarios", error?.message.includes("registered") ? "Esse usuário já existe." : error?.message ?? "Falha ao criar.");
  const { error: e2 } = await adm.from("profiles").insert({ id: data!.user!.id, username, full_name, role });
  if (e2) {
    await adm.auth.admin.deleteUser(data!.user!.id);
    back("/admin/usuarios", e2.code === "23505" ? "Esse usuário já existe." : e2.message);
  }
  redirect(`/admin/usuarios/${data!.user!.id}?ok=${encodeURIComponent("Usuário criado. Defina agora as casas e setores.")}`);
}

export default async function Usuarios({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const { sb } = await getUser();
  const { data } = await sb.from("profiles").select("id,username,full_name,role,active").order("active", { ascending: false }).order("full_name");
  return (
    <Page title="Usuários">
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <details className="card">
        <summary className="min-h-[44px] cursor-pointer font-semibold leading-[44px]">+ Novo usuário</summary>
        <form action={criar} className="mt-2 space-y-3">
          <div><label className="label">Nome completo</label><input name="full_name" className="input" required /></div>
          <div><label className="label">Usuário (login)</label><input name="username" className="input" autoCapitalize="none" required /></div>
          <div><label className="label">Senha inicial</label><input name="password" className="input" minLength={6} required /></div>
          <div>
            <label className="label">Perfil</label>
            <select name="role" className="input" defaultValue="leader">
              <option value="leader">Líder</option><option value="manager">Gestor</option><option value="dp">DP</option><option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn">Criar usuário</button>
        </form>
      </details>
      <ul className="space-y-2">
        {(data ?? []).map((u) => (
          <li key={u.id}>
            <Link href={`/admin/usuarios/${u.id}`} className={"card flex min-h-[64px] items-center justify-between " + (u.active ? "" : "opacity-60")}>
              <span className="min-w-0"><span className="block truncate font-semibold">{u.full_name}</span><span className="muted">{u.username} · {ROLE_LABEL[u.role]}{u.active ? "" : " · desativado"}</span></span>
              <span className="text-stone-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
