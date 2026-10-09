import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getCtx, getSectors } from "@/lib/ctx";
import { addDays, dm, dmy, hm, mondayOf, today, weekday } from "@/lib/util";

export const dynamic = "force-dynamic";

// PDF da escala da semana. ?w=AAAA-MM-DD (qualquer dia da semana) &s=<setor> (vazio = todos)
export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  const sectors = await getSectors(ctx);
  const sp = req.nextUrl.searchParams;
  const only = sectors.find((x) => x.id === sp.get("s"));
  const shown = only ? [only] : sectors;
  const ids = shown.map((x) => x.id);
  const week = mondayOf(sp.get("w") ?? today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  if (!ids.length) return new NextResponse("Sem setor", { status: 404 });

  const [{ data: shifts }, { data: people }, { data: schs }, { data: extras }] = await Promise.all([
    ctx.sb.from("shifts").select("id,name,start_time,end_time,sector_id").in("sector_id", ids),
    ctx.sb.from("people").select("id,name,sector_id,base_shift_id,positions!position_id(name)").in("sector_id", ids).eq("active", true).eq("kind", "employee").order("name"),
    ctx.sb.from("schedules").select("id,status,sector_id").in("sector_id", ids).eq("week_start", week),
    ctx.sb.from("extra_requests").select("work_date,shift_id,sector_id,status,person_id,people!person_id(name),positions!position_id(name)")
      .in("sector_id", ids).gte("work_date", days[0]).lte("work_date", days[6]).order("work_date"),
  ]);
  const schIds = (schs ?? []).map((x) => x.id);
  const [{ data: entries }, { data: offs }] = schIds.length
    ? await Promise.all([
        ctx.sb.from("schedule_entries").select("person_id,day,shift_id").in("schedule_id", schIds),
        ctx.sb.from("schedule_offs").select("person_id,day,removed").in("schedule_id", schIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const k = (p: string, d: string) => `${p}|${d}`;
  const shiftMap = new Map((shifts ?? []).map((s) => [s.id, s]));
  const offSet = new Set((offs ?? []).filter((o: any) => !o.removed).map((o: any) => k(o.person_id, o.day)));
  const gone = new Set((offs ?? []).filter((o: any) => o.removed).map((o: any) => k(o.person_id, o.day)));
  const over = new Map((entries ?? []).map((e: any) => [k(e.person_id, e.day), e.shift_id as string]));
  const cell = (p: any, d: string): string => {
    const key = k(p.id, d);
    if (gone.has(key)) return "-";
    if (offSet.has(key)) return "FOLGA";
    const sid = over.get(key) ?? p.base_shift_id;
    const s = sid ? shiftMap.get(sid) : null;
    return s ? `${s.name} ${hm(s.start_time)}` : "-";
  };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 28;
  const nameW = 150, colW = (W - 2 * M - nameW) / 7, rowH = 22;
  const ink = rgb(0.08, 0.13, 0.11), teal = rgb(0.05, 0.42, 0.38), grey = rgb(0.45, 0.47, 0.46), line = rgb(0.85, 0.87, 0.86);

  const fit = (t: string, f: PDFFont, size: number, max: number) => {
    let s = t;
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1);
    return s === t ? t : s.slice(0, -1) + ".";
  };
  const sent = (schs ?? []).length > 0 && (schs ?? []).every((x) => x.status === "sent");
  let page!: PDFPage; let y = 0;
  const newPage = (title: string) => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 52, width: W, height: 52, color: rgb(0.08, 0.13, 0.11) });
    page.drawText(ctx.house.name, { x: M, y: H - 32, size: 16, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Escala ${dm(days[0])} a ${dmy(days[6])}  ·  ${sent ? "Enviada ao DP" : "Rascunho"}`, { x: W - M - 280, y: H - 30, size: 10, font, color: rgb(0.85, 0.9, 0.88) });
    page.drawText(title, { x: M, y: H - 76, size: 13, font: bold, color: teal });
    y = H - 96;
  };
  const header = () => {
    page.drawRectangle({ x: M, y: y - rowH + 6, width: W - 2 * M, height: rowH, color: rgb(0.93, 0.95, 0.94) });
    page.drawText("Nome", { x: M + 6, y: y - 8, size: 9, font: bold, color: ink });
    days.forEach((d, i) => page.drawText(`${weekday(d)} ${dm(d)}`, { x: M + nameW + i * colW + 6, y: y - 8, size: 9, font: bold, color: ink }));
    y -= rowH;
  };
  const row = (name: string, sub: string, cells: string[], extra = false) => {
    if (y < M + rowH) { newPage(cur); header(); }
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: line });
    page.drawText(fit(name, bold, 9, nameW - 10), { x: M + 6, y: y - 6, size: 9, font: bold, color: ink });
    if (sub) page.drawText(fit(sub, font, 7, nameW - 10), { x: M + 6, y: y - 15, size: 7, font, color: grey });
    cells.forEach((c, i) => {
      const off = c === "FOLGA", none = c === "-" || c === "";
      page.drawText(fit(c, off || extra ? bold : font, 8, colW - 8), { x: M + nameW + i * colW + 6, y: y - 8, size: 8, font: off || extra ? bold : font, color: none ? grey : off ? rgb(0.7, 0.35, 0.1) : extra ? teal : ink });
    });
    y -= rowH;
  };
  let cur = "";

  for (const sec of shown) {
    cur = sec.name;
    newPage(sec.name);
    header();
    for (const p of (people ?? []).filter((x: any) => x.sector_id === sec.id) as any[]) {
      row(p.name, p.positions?.name ?? "", days.map((d) => cell(p, d)));
    }
    // extras do setor, uma linha por pessoa
    const ex = (extras ?? []).filter((e: any) => e.sector_id === sec.id) as any[];
    const lab: Record<string, string> = { pending: "aguard. DP", approved: "aprovado", rejected: "recusado", cancelled: "cancelado" };
    const byPerson = new Map<string, any[]>();
    for (const e of ex) (byPerson.get(e.person_id) ?? byPerson.set(e.person_id, []).get(e.person_id)!).push(e);
    for (const list of byPerson.values()) {
      const cells = days.map((d) => {
        const e = list.find((x) => x.work_date === d);
        const s = e ? shiftMap.get(e.shift_id) : null;
        return e && s ? `${s.name} ${hm(s.start_time)} (${lab[e.status]})` : "";
      });
      row(`EXTRA: ${list[0].people?.name ?? ""}`, list[0].positions?.name ?? "", cells, true);
    }
    if (!(people ?? []).some((x: any) => x.sector_id === sec.id) && !ex.length) {
      page.drawText("Sem equipe cadastrada neste setor.", { x: M, y: y - 8, size: 10, font, color: grey });
    }
  }
  pdf.getPages().forEach((p, i, all) => p.drawText(`Gerado em ${dmy(today())}  ·  página ${i + 1} de ${all.length}`, { x: M, y: 14, size: 7, font, color: grey }));

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="escala-${week}.pdf"` },
  });
}
