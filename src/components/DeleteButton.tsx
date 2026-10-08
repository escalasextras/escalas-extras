"use client";

export default function DeleteButton({ what }: { what: string }) {
  return (
    <button
      className="chip shrink-0 !border-red-200 !text-red-700"
      onClick={(e) => {
        if (!window.confirm(`Excluir ${what}? Isso não pode ser desfeito.`)) e.preventDefault();
      }}
    >
      Excluir
    </button>
  );
}
