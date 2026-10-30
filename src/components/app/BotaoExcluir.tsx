"use client";

import { useFormStatus } from "react-dom";

export function BotaoExcluir({ nome }: { nome: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(`Excluir "${nome}"? A simulação será apagada e não dá para desfazer.`)) {
          e.preventDefault();
        }
      }}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-bad/40 bg-surface text-bad hover:bg-bad-soft"
    >
      {pending ? "Excluindo..." : "Excluir empresa"}
    </button>
  );
}
