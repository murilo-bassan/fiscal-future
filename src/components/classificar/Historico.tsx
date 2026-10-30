import type { ItemClassificado } from "@/lib/classificador";
import { SeloConfianca, SeloReducao } from "./Selos";

export type ItemHistorico = { id: string; createdAt: Date; item: ItemClassificado | null; descricao: string };

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function Historico({ itens }: { itens: ItemHistorico[] }) {
  if (itens.length === 0) {
    return <p className="text-sm text-muted">Você ainda não classificou nenhum item.</p>;
  }
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {itens.map((h) => (
        <li key={h.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink" title={h.descricao}>
              {h.descricao}
            </p>
            <p className="text-xs text-muted">
              {h.item?.categoriaNome ?? "Resultado indisponível"} · {dataHora.format(h.createdAt)}
            </p>
          </div>
          {h.item && (
            <div className="flex items-center gap-3">
              <SeloConfianca confianca={h.item.confianca} />
              <SeloReducao reducao={h.item.reducao} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
