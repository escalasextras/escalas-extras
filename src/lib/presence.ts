import type { SupabaseClient } from "@supabase/supabase-js";
import { mondayOf } from "./util";

export type Present = { id: string; name: string; extra: boolean; positionName?: string };

// Quem está na escala de cada turno no dia: turno base ou troca do dia, menos folgas/excluídos,
// mais os extras (pendentes ou aprovados). Retorna shift_id -> pessoas.
export async function presenceForDay(sb: SupabaseClient, sectorIds: string[], day: string): Promise<Map<string, Present[]>> {
  const out = new Map<string, Present[]>();
  if (!sectorIds.length) return out;
  const week = mondayOf(day);
  const [{ data: people }, { data: schs }, { data: exs }] = await Promise.all([
    sb.from("people").select("id,name,base_shift_id,positions!position_id(name)").in("sector_id", sectorIds).eq("active", true).eq("kind", "employee"),
    sb.from("schedules").select("id").in("sector_id", sectorIds).eq("week_start", week),
    sb.from("extra_requests").select("shift_id,person_id,people!person_id(name),positions!position_id(name)")
      .in("sector_id", sectorIds).eq("work_date", day).in("status", ["pending", "approved"]),
  ]);
  const schIds = (schs ?? []).map((s) => s.id);
  const [{ data: ents }, { data: offs }] = schIds.length
    ? await Promise.all([
        sb.from("schedule_entries").select("person_id,shift_id").in("schedule_id", schIds).eq("day", day),
        sb.from("schedule_offs").select("person_id").in("schedule_id", schIds).eq("day", day),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const off = new Set((offs ?? []).map((o: any) => o.person_id));
  const over = new Map((ents ?? []).map((e: any) => [e.person_id, e.shift_id as string]));
  const add = (shift: string, p: Present) => {
    const l = out.get(shift) ?? [];
    if (!l.some((x) => x.id === p.id)) l.push(p);
    out.set(shift, l);
  };
  for (const p of (people ?? []) as any[]) {
    if (off.has(p.id)) continue;
    const sh = over.get(p.id) ?? p.base_shift_id;
    if (sh) add(sh, { id: p.id, name: p.name, extra: false, positionName: p.positions?.name });
  }
  for (const e of (exs ?? []) as any[]) add(e.shift_id, { id: e.person_id, name: e.people?.name ?? "", extra: true, positionName: e.positions?.name });
  for (const l of out.values()) l.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
