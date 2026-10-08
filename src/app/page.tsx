import { redirect } from "next/navigation";
import { getCtx } from "@/lib/ctx";

export default async function Home() {
  const ctx = await getCtx();
  redirect(ctx.isDp ? "/pendencias" : "/escala");
}
