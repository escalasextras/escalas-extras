"use server";
import { getCtx } from "@/lib/ctx";
import { back, refresh } from "@/lib/act";

export async function decidir(formData: FormData) {
  const ctx = await getCtx();
  const ret = String(formData.get("ret") || "/pendencias");
  const approve = formData.get("approve") === "1";
  const { error } = await ctx.sb.rpc("decide_extra", {
    p_id: String(formData.get("id")), p_approve: approve, p_note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) back(ret, error.message);
  refresh("/pendencias", "/extras");
  back(ret, approve ? "Vaga aprovada." : "Vaga recusada.", "ok");
}

export async function cancelar(formData: FormData) {
  const ctx = await getCtx();
  const ret = String(formData.get("ret") || "/extras");
  const { error } = await ctx.sb.rpc("cancel_extra", { p_id: String(formData.get("id")) });
  if (error) back(ret, error.message);
  refresh("/pendencias", "/extras");
  back(ret, "Vaga cancelada.", "ok");
}

export async function presenca(formData: FormData) {
  const ctx = await getCtx();
  const ret = String(formData.get("ret") || "/extras");
  const present = formData.get("present") === "1";
  const suspend = formData.get("suspend") === "1";
  const days = String(formData.get("days") ?? "15");
  const { error } = await ctx.sb.rpc("mark_attendance", {
    p_id: String(formData.get("id")), p_present: present, p_suspend: suspend,
    p_days: days === "x" ? null : Number(days), p_reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (error) back(ret, error.message);
  refresh("/pendencias", "/extras", "/equipe");
  back(ret, present ? "Presença confirmada." : suspend ? "Falta registrada e pessoa suspensa." : "Falta registrada.", "ok");
}
