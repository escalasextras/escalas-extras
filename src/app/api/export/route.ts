import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/ctx";
import { today } from "@/lib/util";

export const dynamic = "force-dynamic";

// Extras aprovados da casa atual. ?de=AAAA-MM-DD&ate=AAAA-MM-DD (padrão: mês corrente)
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx.isDp) return new NextResponse("Sem permissão", { status: 403 });
  const t = today();
  const de = req.nextUrl.searchParams.get("de") ?? `${t.slice(0, 8)}01`;
  const ate = req.nextUrl.searchParams.get("ate") ?? t.slice(0, 8) + "31";

  const { data, error } = await ctx.sb
    .from("extra_requests")
    .select(
      "work_date,amount,note,attendance,decided_at," +
        "shifts(name,start_time,end_time),positions(name),sectors(name),extra_reasons(name)," +
        "person:people!extra_requests_person_id_fkey(name,cpf,pix,kind),absent:people!extra_requests_absent_person_id_fkey(name)," +
        "requester:profiles!extra_requests_requested_by_fkey(full_name),approver:profiles!extra_requests_decided_by_fkey(full_name)"
    )
    .eq("house_id", ctx.house.id).eq("status", "approved")
    .gte("work_date", de).lte("work_date", ate)
    .order("work_date");
  if (error) return new NextResponse(error.message, { status: 500 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Extras aprovados");
  ws.columns = [
    { header: "Casa", key: "casa", width: 20 }, { header: "Data", key: "data", width: 12 }, { header: "Setor", key: "setor", width: 16 },
    { header: "Turno", key: "turno", width: 14 }, { header: "Cargo", key: "cargo", width: 18 }, { header: "Nome", key: "nome", width: 28 },
    { header: "CPF", key: "cpf", width: 16 }, { header: "Tipo", key: "tipo", width: 13 }, { header: "PIX", key: "pix", width: 24 },
    { header: "Valor (R$)", key: "valor", width: 13 }, { header: "Motivo", key: "motivo", width: 24 }, { header: "Quem faltou", key: "faltou", width: 24 },
    { header: "Observação", key: "obs", width: 30 }, { header: "Presença", key: "pres", width: 12 }, { header: "Solicitante", key: "sol", width: 22 }, { header: "Aprovador", key: "apr", width: 22 },
  ];
  const kind: Record<string, string> = { employee: "Funcionário", freelancer: "Freelancer", candidate: "Candidato" };
  for (const r of (data ?? []) as any[]) {
    ws.addRow({
      casa: ctx.house.name, data: new Date(`${r.work_date}T12:00:00`), setor: r.sectors.name,
      turno: `${r.shifts.name} ${r.shifts.start_time.slice(0, 5)}–${r.shifts.end_time.slice(0, 5)}`, cargo: r.positions.name,
      nome: r.person.name, cpf: r.person.cpf ?? "", tipo: kind[r.person.kind], pix: r.person.pix ?? "", valor: Number(r.amount),
      motivo: r.extra_reasons.name, faltou: r.absent?.name ?? "", obs: r.note ?? "",
      pres: r.attendance === "present" ? "Compareceu" : r.attendance === "absent" ? "Faltou" : "A confirmar",
      sol: r.requester?.full_name ?? "", apr: r.approver?.full_name ?? "",
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.getColumn("data").numFmt = "dd/mm/yyyy";
  ws.getColumn("valor").numFmt = "#,##0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const total = ws.addRow({ nome: "TOTAL (compareceram + a confirmar)", valor: { formula: `SUMIF(N2:N${ws.rowCount},"<>Faltou",J2:J${ws.rowCount})` } as any });
  total.font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  const nome = `extras_${ctx.house.name.replace(/[^a-z0-9]+/gi, "_")}_${de}_${ate}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
