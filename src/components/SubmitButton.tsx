"use client";
import { useFormStatus } from "react-dom";

// Botão que mostra "Salvando..." e bloqueia toques repetidos enquanto envia
export default function SubmitButton({ children, className = "btn" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? "Salvando..." : children}
    </button>
  );
}
