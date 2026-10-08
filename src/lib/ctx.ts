import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Role = "admin" | "dp" | "leader";
export type Profile = { id: string; username: string; full_name: string; role: Role };
export type House = { id: string; name: string };
export type Sector = { id: string; name: string };

export async function getUser() {
  const sb = supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("id,username,full_name,role,active").eq("id", data.user.id).single();
  if (!profile || !profile.active) redirect("/login?erro=inativo");
  return { sb, profile: profile as Profile };
}

// Usuário + casa escolhida. Sem casa válida, vai para a escolha de casa.
export async function getCtx() {
  const { sb, profile } = await getUser();
  const { data: houses } = await sb.from("houses").select("id,name").eq("active", true).order("name");
  const list = (houses ?? []) as House[];
  const cid = cookies().get("house_id")?.value;
  let house = list.find((h) => h.id === cid);
  if (!house && list.length === 1) house = list[0];
  if (!house) redirect("/casas");
  return { sb, profile, house, houses: list, isDp: profile.role !== "leader" };
}

export type Ctx = Awaited<ReturnType<typeof getCtx>>;

// Setores que a pessoa pode ver/gerir na casa atual
export async function getSectors(ctx: Ctx): Promise<Sector[]> {
  if (ctx.profile.role === "leader") {
    const { data } = await ctx.sb
      .from("leader_sectors")
      .select("sectors!inner(id,name,house_id,active)")
      .eq("user_id", ctx.profile.id);
    return (data ?? [])
      .map((r: any) => r.sectors)
      .filter((s: any) => s.house_id === ctx.house.id && s.active)
      .map((s: any) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const { data } = await ctx.sb
    .from("sectors").select("id,name").eq("house_id", ctx.house.id).eq("active", true).order("name");
  return (data ?? []) as Sector[];
}

export function pickSector(sectors: Sector[], wanted?: string) {
  return sectors.find((s) => s.id === wanted) ?? sectors[0] ?? null;
}

export async function requireDp() {
  const ctx = await getCtx();
  if (!ctx.isDp) redirect("/");
  return ctx;
}
