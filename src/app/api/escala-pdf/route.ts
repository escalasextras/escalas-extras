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
  const nameW = 150, colW = (W - 2 * M - nameW) / 7, rowH = 15;
  const ink = rgb(0.08, 0.13, 0.11), teal = rgb(0.05, 0.42, 0.38), grey = rgb(0.45, 0.47, 0.46), line = rgb(0.85, 0.87, 0.86);

  const fit = (t: string, f: PDFFont, size: number, max: number) => {
    let s = t;
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1);
    return s === t ? t : s.slice(0, -1) + ".";
  };
  const sent = (schs ?? []).length > 0 && (schs ?? []).every((x) => x.status === "sent");
  let page!: PDFPage; let y = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: rgb(0.08, 0.13, 0.11) });
    page.drawText(ctx.house.name, { x: M, y: H - 22, size: 13, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Escala ${dm(days[0])} a ${dmy(days[6])}  ·  ${sent ? "Enviada ao DP" : "Rascunho"}`, { x: W - M - 230, y: H - 21, size: 9, font, color: rgb(0.85, 0.9, 0.88) });
    y = H - 50;
  };
  const header = () => {
    const title = `${cur}  ·  ${info.total}`;
    page.drawText(title, { x: M, y: y - 2, size: 10, font: bold, color: teal });
    info.perDay.forEach((n, i) => page.drawText(`${n}`, { x: M + nameW + i * colW + 4, y: y - 2, size: 7.5, font: bold, color: teal }));
    y -= 12;
    page.drawRectangle({ x: M, y: y - rowH + 4, width: W - 2 * M, height: rowH, color: rgb(0.93, 0.95, 0.94) });
    page.drawText("Nome", { x: M + 4, y: y - 7, size: 7.5, font: bold, color: ink });
    days.forEach((d, i) => page.drawText(`${weekday(d)} ${dm(d)}`, { x: M + nameW + i * colW + 4, y: y - 7, size: 7.5, font: bold, color: ink }));
    y -= rowH;
  };
  const row = (name: string, sub: string, cells: string[], extra = false, colors: (ReturnType<typeof rgb> | null)[] = []) => {
    if (y < M + rowH) { newPage(); header(); }
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.4, color: line });
    const nm = fit(name, bold, 7.5, nameW - 8);
    page.drawText(nm, { x: M + 4, y: y - 6, size: 7.5, font: bold, color: ink });
    if (sub) {
      const left = nameW - 8 - bold.widthOfTextAtSize(nm, 7.5) - 4;
      if (left > 20) page.drawText(fit(sub, font, 6, left), { x: M + 4 + bold.widthOfTextAtSize(nm, 7.5) + 4, y: y - 6, size: 6, font, color: grey });
    }
    cells.forEach((c, i) => {
      const off = c === "FOLGA", none = c === "-" || c === "";
      const f = off || extra ? bold : font;
      page.drawText(fit(c, f, 7, colW - 6), { x: M + nameW + i * colW + 4, y: y - 6, size: 7, font: f, color: none ? grey : colors[i] ?? (off ? rgb(0.7, 0.35, 0.1) : extra ? teal : ink) });
    });
    y -= rowH;
  };
  let cur = "";
  let info = { total: 0, perDay: [] as number[] };

  for (const sec of shown) {
    cur = sec.name;
    const team = (people ?? []).filter((x: any) => x.sector_id === sec.id) as any[];
    const exSec = (extras ?? []).filter((e: any) => e.sector_id === sec.id && ["pending", "approved"].includes(e.status)) as any[];
    const perDay = days.map((d) => team.filter((p) => { const c = cell(p, d); return c !== "-" && c !== "FOLGA"; }).length + new Set(exSec.filter((e) => e.work_date === d).map((e) => e.person_id)).size);
    const everyone = new Set<string>();
    team.forEach((p) => { if (days.some((d) => { const c = cell(p, d); return c !== "-" && c !== "FOLGA"; })) everyone.add(p.id); });
    exSec.forEach((e) => everyone.add(e.person_id));
    info = { total: everyone.size, perDay };
    const need = rowH * 4 + 24;
    if (!page || y < M + need) newPage(); else y -= 10;
    header();
    for (const p of (people ?? []).filter((x: any) => x.sector_id === sec.id) as any[]) {
      row(p.name, p.positions?.name ?? "", days.map((d) => cell(p, d)));
    }
    // extras do setor, uma linha por pessoa
    const ex = (extras ?? []).filter((e: any) => e.sector_id === sec.id) as any[];
    const byPerson = new Map<string, any[]>();
    for (const e of ex) (byPerson.get(e.person_id) ?? byPerson.set(e.person_id, []).get(e.person_id)!).push(e);
    for (const list of byPerson.values()) {
      const hue: Record<string, ReturnType<typeof rgb>> = { approved: teal, pending: rgb(0.78, 0.5, 0.05), rejected: rgb(0.75, 0.15, 0.15), cancelled: rgb(0.75, 0.15, 0.15) };
      const found = days.map((d) => list.find((x) => x.work_date === d));
      const cells = found.map((e) => { const s = e ? shiftMap.get(e.shift_id) : null; return e && s ? `${s.name} ${hm(s.start_time)}` : ""; });
      row(`EXTRA: ${list[0].people?.name ?? ""}`, list[0].positions?.name ?? "", cells, true, found.map((e) => (e ? hue[e.status] : null)));
    }
    if (!(people ?? []).some((x: any) => x.sector_id === sec.id) && !ex.length) {
      page.drawText("Sem equipe cadastrada neste setor.", { x: M + 4, y: y - 6, size: 8, font, color: grey }); y -= rowH;
    }
  }
  pdf.getPages().forEach((p, i, all) => p.drawText(`Gerado em ${dmy(today())}  ·  página ${i + 1} de ${all.length}`, { x: M, y: 14, size: 7, font, color: grey }));

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="escala-${week}.pdf"` },
  });
}
