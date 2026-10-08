export const brl = (n: number | string) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// datas "YYYY-MM-DD" tratadas ao meio-dia local para evitar virada por fuso
export const parse = (s: string) => new Date(`${s}T12:00:00`);
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const mondayOf = (s: string) => {
  const d = parse(s);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return iso(d);
};
// "hoje" no fuso de São Paulo
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const weekday = (s: string) => WD[parse(s).getDay()];
export const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const dmy = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export const hm = (t: string) => t.slice(0, 5);

export const onlyDigits = (s: string) => s.replace(/\D/g, "");
export const maskCpf = (cpf?: string | null) => {
  const d = onlyDigits(cpf ?? "");
  if (d.length !== 11) return cpf ? "•••" : "—";
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
};
export const fmtCpf = (cpf?: string | null) => {
  const d = onlyDigits(cpf ?? "");
  if (d.length !== 11) return cpf ?? "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando DP",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};
export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-stone-200 text-stone-600",
};
export const ROLE_LABEL: Record<string, string> = { admin: "Admin", dp: "DP", leader: "Líder" };
