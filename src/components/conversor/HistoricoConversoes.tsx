"use client";

import type { ResumoConversao } from "./modelo";
import { pctSinal } from "@/components/app/formato";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function HistoricoConversoes({
  itens,
  atual,
  abrindo,
  onAbrir,
}: {
  itens: ResumoConversao[];
  atual: string | null;
  abrindo: string | null;
  onAbrir: (id: string) => void;
}) {
  if (itens.length === 0) {
    return <p className="text-sm text-muted">Você ainda não converteu nenhuma nota.</p>;
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {itens.map((h) => (
        <li key={h.id}>
          <button
            type="button"
            onClick={() => onAbrir(h.id)}
            disabled={abrindo !== null}
            aria-current={atual === h.id ? "true" : undefined}
            className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors ${
              atual === h.id ? "bg-brand-soft" : "hover:bg-paper"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                Nota {h.numero}, {h.emitente}
                {h.exemplo && <span className="ml-2 font-normal text-muted">(exemplo)</span>}
              </span>
              <span className="block text-xs text-muted">
                {abrindo === h.id ? "Abrindo…" : `Convertida em ${dataHora.format(new Date(h.createdAt))}`}
              </span>
            </span>
            <Variacao v={h.variacao} ano={h.ano} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Variacao({ v, ano }: { v: number | null; ano: number }) {
  if (v === null) return <span className="text-xs text-muted">{ano}</span>;
  const cor = Math.abs(v) < 0.0005 ? "text-muted" : v > 0 ? "text-bad" : "text-good";
  return (
    <span className="shrink-0 text-sm">
      <span className="text-muted">em {ano} </span>
      <span className={`font-semibold ${cor}`}>{pctSinal(v)}</span>
    </span>
  );
}
