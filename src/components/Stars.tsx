// Estrelas só para mostrar (média pode ser fracionada)
export default function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${size}`} aria-label={`${value.toFixed(1)} de 5`}>
      <span className="tracking-tight text-amber-500">{"★".repeat(full)}<span className="text-stone-300">{"★".repeat(5 - full)}</span></span>
      <span className="text-sm font-bold text-stone-700">{value.toFixed(1)}</span>
    </span>
  );
}
