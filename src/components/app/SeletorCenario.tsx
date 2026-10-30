import Link from "next/link";
import { PRESETS } from "@/lib/tax";

/** Troca o cenário via ?cenario=... sem salvar nada. */
export function SeletorCenario({
  base,
  atual,
  salvo,
}: {
  base: string;
  atual: string;
  salvo: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-sm text-muted">Cenário de alíquota</span>
      <div role="group" aria-label="Cenário de alíquota" className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-1">
        {PRESETS.map((p) => {
          const ativo = p.id === atual;
          return (
            <Link
              key={p.id}
              href={p.id === salvo ? base : `${base}?cenario=${p.id}`}
              aria-current={ativo ? "true" : undefined}
              scroll={false}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                ativo ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {p.nome}
            </Link>
          );
        })}
      </div>
      {atual !== salvo && (
        <span className="text-xs text-muted">Só para comparar: o cenário salvo não muda.</span>
      )}
    </div>
  );
}
