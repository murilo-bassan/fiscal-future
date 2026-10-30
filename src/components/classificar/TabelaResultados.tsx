import type { ItemClassificado } from "@/lib/classificador";
import { SeloConfianca, SeloReducao } from "./Selos";

/** Tabela de resultados (sem estado: serve no cliente e no servidor). */
export function TabelaResultados({ itens, compacta = false }: { itens: ItemClassificado[]; compacta?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-paper text-xs text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Item</th>
            <th className="px-4 py-2.5 font-medium">Tratamento</th>
            <th className="px-4 py-2.5 font-medium">Confiança</th>
            {!compacta && <th className="px-4 py-2.5 font-medium">Confira antes de emitir nota</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {itens.map((r, i) => (
            <tr key={`${r.descricao}-${i}`} className="align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-ink">{r.descricao}</p>
                <p className="mt-0.5 text-xs text-muted">{r.categoriaNome}</p>
                {!compacta && <p className="mt-1.5 text-xs text-muted">{r.justificativa}</p>}
                {r.regimeEspecifico && (
                  <p className="mt-1.5 inline-block rounded bg-accent-soft px-1.5 py-0.5 text-xs text-ink">
                    Regime específico: {r.regimeEspecifico}
                  </p>
                )}
                {r.origem === "palavras-chave" && !compacta && (
                  <p className="mt-1 text-xs text-muted">Classificado por palavras-chave.</p>
                )}
              </td>
              <td className="px-4 py-3">
                <SeloReducao reducao={r.reducao} />
              </td>
              <td className="px-4 py-3">
                <SeloConfianca confianca={r.confianca} />
              </td>
              {!compacta && <td className="px-4 py-3 text-xs text-ink">{r.conferir}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
