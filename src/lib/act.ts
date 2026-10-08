import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Volta para a mesma tela com mensagem de erro ou sucesso
export function back(path: string, msg?: string, tone: "erro" | "ok" = "erro"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(msg ? `${path}${sep}${tone}=${encodeURIComponent(msg)}` : path);
}
export function refresh(...paths: string[]) {
  paths.forEach((p) => revalidatePath(p));
}
export const cleanErr = (m?: string | null) => m ?? "Não foi possível concluir.";

// Mensagem amigável quando o registro já está em uso (chave estrangeira)
export const delErr = (e: { code?: string; message?: string }) =>
  e.code === "23503" ? "Não dá para excluir: já tem registros ligados a isso. Use Desativar." : (e.message ?? "Não foi possível excluir.");
