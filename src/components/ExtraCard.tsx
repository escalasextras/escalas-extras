import { brl, dm, hm, today, weekday, STATUS_LABEL, STATUS_STYLE } from "@/lib/util";
import { cancelar, decidir, presenca } from "@/app/(app)/extras/actions";

export type ExtraRow = {
  id: string; work_date: string; amount: number; status: string; note: string | null; attendance: string | null;
  decision_note: string | null; requested_at: string;
  shifts: { name: string; start_time: string; end_time: string };
  positions: { name: string };
  person: { name: string };
  absent: { name: string } | null;
  sectors: { name: string };
  extra_reasons: { name: string };
  requester: { full_name: string } | null;
};

export const EXTRA_SELECT =
  "id,work_date,amount,status,note,attendance,decision_note,requested_at," +
  "shifts(name,start_time,end_time),positions(name),sectors(name),extra_reasons(name)," +
  "person:people!extra_requests_person_id_fkey(name),absent:people!extra_requests_absent_person_id_fkey(name)," +
  "requester:profiles!extra_requests_requested_by_fkey(full_name)";

export default function ExtraCard({ e, ret, mode }: { e: ExtraRow; ret: string; mode: "dp" | "leader" }) {
  const due = (e.status === "approved" || e.status === "pending") && !e.attendance && e.work_date <= today();
  return (
    <li className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{weekday(e.work_date)} {dm(e.work_date)} · {e.shifts.name} <span className="text-sm font-normal text-stone-500">{hm(e.shifts.start_time)}–{hm(e.shifts.end_time)}</span></div>
          <div className="muted truncate">{e.sectors.name} · {e.positions.name}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold">{brl(e.amount)}</div>
          <span className={`badge ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
        </div>
      </div>

      <div className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
        <div><span className="text-stone-500">Quem: </span><span className="font-semibold">{e.person.name}</span></div>
        <div><span className="text-stone-500">Motivo: </span>{e.extra_reasons.name}{e.absent ? ` (faltou: ${e.absent.name})` : ""}</div>
        {e.note && <div className="text-stone-600">“{e.note}”</div>}
        {mode === "dp" && e.requester && <div className="text-stone-500">Pedido por {e.requester.full_name}</div>}
        {e.decision_note && <div className="text-red-700">Recusa: {e.decision_note}</div>}
      </div>

      {e.attendance && (
        <p className={`text-sm font-semibold ${e.attendance === "present" ? "text-emerald-700" : "text-red-700"}`}>
          {e.attendance === "present" ? "✓ Compareceu" : "✕ Faltou"}
        </p>
      )}

      {mode === "dp" && e.status === "pending" && (
        <div className="space-y-2">
          <form action={decidir}>
            <input type="hidden" name="id" value={e.id} /><input type="hidden" name="approve" value="1" /><input type="hidden" name="ret" value={ret} />
            <button className="btn">Aprovar</button>
          </form>
          <details>
            <summary className="btn-ghost cursor-pointer list-none">Recusar</summary>
            <form action={decidir} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={e.id} /><input type="hidden" name="approve" value="0" /><input type="hidden" name="ret" value={ret} />
              <input name="note" className="input" placeholder="Motivo da recusa" required />
              <button className="btn-danger">Confirmar recusa</button>
            </form>
          </details>
        </div>
      )}

      {mode === "leader" && e.status === "pending" && (
        <form action={cancelar}>
          <input type="hidden" name="id" value={e.id} /><input type="hidden" name="ret" value={ret} />
          <button className="btn-ghost btn-sm">Cancelar vaga</button>
        </form>
      )}

      {due && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-amber-800">Confirme a presença</p>
          <form action={presenca}>
            <input type="hidden" name="id" value={e.id} /><input type="hidden" name="present" value="1" /><input type="hidden" name="ret" value={ret} />
            <button className="btn">Compareceu</button>
          </form>
          <details>
            <summary className="btn-danger cursor-pointer list-none">Faltou</summary>
            <form action={presenca} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={e.id} /><input type="hidden" name="present" value="0" /><input type="hidden" name="ret" value={ret} />
              <label className="label">Suspender de extras por</label>
              <select name="days" className="input" defaultValue="15">
                <option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option>
                <option value="60">60 dias</option><option value="x">Indeterminado</option>
              </select>
              <input name="reason" className="input" placeholder="Motivo (obrigatório se suspender)" />
              <button name="suspend" value="1" className="btn-danger">Faltou e suspender</button>
              <button name="suspend" value="0" className="btn-ghost">Faltou, sem suspender</button>
            </form>
          </details>
        </div>
      )}
    </li>
  );
}
