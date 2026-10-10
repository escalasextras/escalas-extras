"use client";
import { useState } from "react";

// 5 estrelas grandes para tocar no celular. Envia o valor no campo `name`.
export default function StarInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div className="flex items-center gap-1" role="radiogroup">
      <input type="hidden" name={name} value={v || ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={v === n}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          onClick={() => setV(v === n ? 0 : n)}
          className={`grid h-11 w-11 place-items-center text-3xl leading-none ${n <= v ? "text-amber-500" : "text-stone-300"}`}
        >
          ★
        </button>
      ))}
      <span className="ml-1 w-5 text-sm font-semibold text-stone-500">{v || ""}</span>
    </div>
  );
}
