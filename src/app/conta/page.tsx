import Link from "next/link";
import { getUser } from "@/lib/ctx";
import { Flash } from "@/components/ui";
import { back } from "@/lib/act";

async function trocar(formData: FormData) {
  "use server";
  const { sb } = await getUser();
  const a = String(formData.get("a") ?? ""), b = String(formData.get("b") ?? "");
  if (a.length < 6) back("/conta", "A senha precisa ter pelo menos 6 caracteres.");
  if (a !== b) back("/conta", "As senhas não são iguais.");
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) back("/conta", error.message);
  back("/conta", "Senha alterada.", "ok");
}

export default async function Conta({ searchParams }: { searchParams: { erro?: string; ok?: string } }) {
  const { profile } = await getUser();
  return (
    <main className="mx-auto max-w-md space-y-4 px-5 py-8">
      <div className="flex items-center justify-between"><h1 className="h1">Minha senha</h1><Link href="/casas" className="chip">Voltar</Link></div>
      <p className="muted">Usuário: {profile.username}</p>
      <Flash msg={searchParams.erro} /><Flash msg={searchParams.ok} tone="ok" />
      <form action={trocar} className="space-y-3">
        <div><label className="label">Nova senha</label><input type="password" name="a" className="input" autoComplete="new-password" required /></div>
        <div><label className="label">Repita a nova senha</label><input type="password" name="b" className="input" autoComplete="new-password" required /></div>
        <button className="btn">Trocar senha</button>
      </form>
    </main>
  );
}
