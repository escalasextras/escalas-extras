import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/supabase/admin";

async function entrar(formData: FormData) {
  "use server";
  const user = String(formData.get("usuario") ?? "");
  const senha = String(formData.get("senha") ?? "");
  const sb = supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: usernameToEmail(user), password: senha });
  if (error) redirect("/login?erro=1");
  redirect("/");
}

export default function Login({ searchParams }: { searchParams: { erro?: string } }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8.5 3.5v3M15.5 3.5v3M8 14.5h3" /></svg>
        </div>
        <h1 className="h1 text-3xl">Escalas e Extras</h1>
        <p className="muted mt-1">Entre com seu usuário e senha.</p>
      </div>
      <form action={entrar} className="space-y-4">
        <div>
          <label className="label" htmlFor="usuario">Usuário</label>
          <input id="usuario" name="usuario" className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username" required />
        </div>
        <div>
          <label className="label" htmlFor="senha">Senha</label>
          <input id="senha" name="senha" type="password" className="input" autoComplete="current-password" required />
        </div>
        {searchParams.erro && (
          <p className="rounded-xl bg-brasa-100 px-3 py-2 text-sm font-medium text-brasa-600">
            {searchParams.erro === "inativo" ? "Usuário desativado. Fale com o Admin." : "Usuário ou senha incorretos."}
          </p>
        )}
        <button className="btn">Entrar</button>
      </form>
    </main>
  );
}
