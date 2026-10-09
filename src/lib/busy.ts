import type { SupabaseClient } from "@supabase/supabase-js";

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
type T = { start_time: string; end_time: string };
function overlap(a: T, b: T) {
  const n = (x: T): [number, number] => { const s = toMin(x.start_time); let e = toMin(x.end_time); if (e <= s) e += 1440; return [s, e]; };
  const [as, ae] = n(a), [bs, be] = n(b);
  return as < be && bs < ae;
}

// Quem já está escalado (turno base, troca do dia ou outro extra) num turno que bate com o do extra.
// Retorna id da pessoa -> nome do turno em que já está.
export async function busyPeople(sb: SupabaseClient, date: string, shift: T, personIds: string[]): Promise<Map<string, string>> {
  const busy = new Map<string, string>();
  if (!personIds.length) return busy;
  const [{ data: ppl }, { data: ents }, { data: offs }, { data: exs }] = await Promise.all([
    sb.from("people").select("id,base_shift_id").in("id", personIds),
    sb.from("schedule_entries").select("person_id,shift_id").eq("day", date).in("person_id", personIds),
    sb.from("schedule_offs").select("person_id").eq("day", date).in("person_id", personIds),
    sb.from("extra_requests").select("person_id,shift_id").eq("work_date", date).in("status", ["pending", "approved"]).in("person_id", personIds),
  ]);
  const off = new Set((offs ?? []).map((o) => o.person_id));
  const override = new Map((ents ?? []).map((e) => [e.person_id, e.shift_id as string]));
  const ids = new Set<string>();
  for (const p of ppl ?? []) if (p.base_shift_id) ids.add(p.base_shift_id);
  for (const v of override.values()) ids.add(v);
  for (const e of exs ?? []) ids.add(e.shift_id);
  const { data: shs } = ids.size ? await sb.from("shifts").select("id,name,start_time,end_time").in("id", [...ids]) : { data: [] as any[] };
  const sm = new Map((shs ?? []).map((s: any) => [s.id, s]));
  const hit = (pid: string, sid: string | null | undefined) => {
    const s = sid ? sm.get(sid) : null;
    if (s && overlap(s, shift) && !busy.has(pid)) busy.set(pid, s.name);
  };
  for (const p of ppl ?? []) {
    if (off.has(p.id)) continue;
    hit(p.id, override.get(p.id) ?? p.base_shift_id);
  }
  for (const e of exs ?? []) hit(e.person_id, e.shift_id);
  return busy;
}
