import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/ctx";
import { Flash, Page } from "@/components/ui";
import { back } from "@/lib/act";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function admin() {
  const { sb, profile } = await getUser();
  if (profile.role !== "admin") redirect("/");
  return { sb, profile };
}

async function dados(formData: FormData) {
  "use server";
  const { sb, profile } = await admin();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  const active = formData.get("active") === "on";
  if (id === profile.id && (!active || role !== "admin")) back(`/admin/usuarios/${id}`, "Você não pode tirar o seu próprio acesso de Admin.");
  const { error } = await sb.from("profiles").update({ full_name: String(formData.get("full_name") ?? "").trim(), role, active }).eq("id", id);
  if (error) back(`/admin/usuarios/${id}`, error.message);
  back(`/admin/usuarios/${id}`, "Dados salvos.", "ok");
}

async function senha(formData: FormData) {
  "use server";
  await admin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) back(`/admin/usuarios/${id}`, "A senha precisa ter pelo menos 6 caracteres.");
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { password });
  if (error) back(`/admin/usuarios/${id}`, error.message);
  back(`/admin/usuarios/${id}`, "Senha alterada.", "ok");
}

async function acessos(formData: FormData) {
  "use server";
  const { sb } = await admin();
  const id = String(formData.get("id"));
  const houses = formData.getAll("house").map(String);
  const sectors = formData.getAll("sector").map(String);
  const r1 = await sb.from("house_members").delete().eq("user_id", id);
  const r2 = await sb.from("leader_sectors").delete().eq("user_id", id);
  if (r1.error || r2.error) back(`/admin/usuarios/${id}`, (r1.error ?? r2.error)!.message);
  if (houses.length) {
    const { error } = await sb.from("house_members").insert(houses.map((house_id) => ({ user_id: id, house_id })));
    if (error) back(`/admin/usuarios/${id}`, error.message);
  }
  if (sectors.length) {
    const { error } = await sb.from("leader_sectors").insert(sectors.map((sector_id) => ({ user_id: id, sector_id })));
    if (error) back(`/admin/usuarios/${id}`, error.message);
  }
  back(`/admin/usuarios/${id}`, "Acessos salvos.", "ok");
}

export default async function Usuario({ params, searchParams }: { params: { id: string }; searchParams: { erro?: string; ok?: string } }) {
  const { sb } = await admin();
  const { data: u } = await sb.from("profiles").select("*").eq("id", params.id).single();
  if (!u) notFound();
  const [{ data: houses }, { data: sectors }, { data: hm }, { data: ls }] = await Promise.all([
    sb.from("houses").select("id,name,active").order("name"),
    sb.from("sectors").select("id,name,house_id,active").eq("active", true).order("name"),
    sb.from("house_members").select("house_id").eq("user_id", u.id),
    sb.from("leader_sectors").select("sector_id").eq("user_id", u.id),
  ]);
  const hset = new Set((hm ?? []).map((r) => r.house_id));
  const sset = new Set((ls ?? []).map((r) => r.sector_id));

  return (
    <Page title={u.full_name} sub={`usuário: ${u.username}`} action={<Link href="/admin/usuarios" className="chip">Voltar</Link>}>
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />

      <form action={dados} className="card space-y-3">
        <input type="hidden" name="id" value={u.id} />
        <div><label className="label">Nome</label><input name="full_name" className="input" defaultValue={u.full_name} required /></div>
        <div>
          <label className="label">Perfil</label>
          <select name="role" className="input" defaultValue={u.role}>
            <option value="leader">Líder</option><option value="dp">DP</option><option value="admin">Admin</option>
          </select>
        </div>
        <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" name="active" defaultChecked={u.active} className="h-5 w-5 accent-teal-700" /> Usuário ativo</label>
        <button className="btn">Salvar</button>
      </form>

      <form action={senha} className="card space-y-3">
        <input type="hidden" name="id" value={u.id} />
        <label className="label">Nova senha</label>
        <input name="password" className="input" minLength={6} required placeholder="mínimo 6 caracteres" />
        <button className="btn-ghost">Trocar senha</button>
      </form>

      {u.role === "admin" ? (
        <p className="card muted">Admin enxerga todas as casas.</p>
      ) : (
        <form action={acessos} className="space-y-3">
          <input type="hidden" name="id" value={u.id} />
          <h2 className="font-semibold">Casas e setores</h2>
          {u.role === "leader" && <p className="muted">O Líder só enxerga os setores marcados.</p>}
          {(houses ?? []).map((h) => (
            <div key={h.id} className="card space-y-1">
              <label className="flex min-h-[44px] items-center gap-3 font-semibold">
                <input type="checkbox" name="house" value={h.id} defaultChecked={hset.has(h.id)} className="h-5 w-5 accent-teal-700" /> {h.name}{!h.active && " (desativada)"}
              </label>
              {u.role === "leader" && (sectors ?? []).filter((s) => s.house_id === h.id).map((s) => (
                <label key={s.id} className="ml-8 flex min-h-[44px] items-center gap-3">
                  <input type="checkbox" name="sector" value={s.id} defaultChecked={sset.has(s.id)} className="h-5 w-5 accent-teal-700" /> {s.name}
                </label>
              ))}
              {u.role === "leader" && !(sectors ?? []).some((s) => s.house_id === h.id) && <p className="muted ml-8">Sem setores. Entre na casa e crie em Config.</p>}
            </div>
          ))}
          <button className="btn">Salvar acessos</button>
        </form>
      )}
    </Page>
  );
}
