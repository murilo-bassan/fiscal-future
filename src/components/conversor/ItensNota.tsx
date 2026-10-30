"use client";

import { CATEGORIAS } from "@/lib/tax/categorias";
import { brl } from "@/components/app/formato";
import { SeloReducao } from "@/components/classificar/Selos";
import { ROTULO_REDUCAO } from "@/components/classificar/rotulos";
import type { ItemSalvo, OrigemItem } from "./modelo";

const ORIGEM: Record<OrigemItem, string> = {
  usuario: "Escolhida por você",
  nota: "Já estava na nota",
  ia: "Sugerida pela IA",
  "palavras-chave": "Sugerida por palavras-chave",
  padrao: "Alíquota padrão por falta de pista",
};

const ncmFormatado = (n: string) => (/^\d{8}$/.test(n) ? `${n.slice(0, 4)}.${n.slice(4, 6)}.${n.slice(6)}` : n || "sem NCM");

/** Lista de itens: em telas largas vira tabela; no celular, um bloco por item. */
export function ItensNota({
  itens,
  ano,
  salvando,
  onTrocar,
}: {
  itens: ItemSalvo[];
  ano: number;
  salvando: number | null;
  onTrocar: (nItem: number, categoriaId: string) => void;
}) {
  const colunas =
    "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.6fr)_repeat(4,minmax(0,0.62fr))] lg:items-start lg:gap-x-4";
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className={`hidden border-b border-line bg-paper px-4 py-2.5 text-xs text-muted lg:grid ${colunas}`} aria-hidden>
        <span>Item</span>
        <span>Classificação no IBS/CBS</span>
        <span className="text-right">Tributos antigos</span>
        <span className="text-right">IBS</span>
        <span className="text-right">CBS</span>
        <span className="text-right">Total em {ano}</span>
      </div>
      <ul className="divide-y divide-line">
        {itens.map((it) => {
          const idSelect = `cat-${it.nItem}`;
          return (
            <li key={it.nItem} className={`grid gap-3 px-4 py-4 ${colunas} ${salvando === it.nItem ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium break-words text-ink">
                  <span className="mr-1.5 text-muted">{it.nItem}.</span>
                  {it.descricao}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>NCM {ncmFormatado(it.ncm)}</span>
                  <span>CFOP {it.cfop}</span>
                  <span className="text-ink">{brl(it.valor, 2)}</span>
                </p>
                {it.conferir && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-ink">
                    <span aria-hidden className="inline-block size-1.5 rounded-full bg-accent" />
                    Conferir
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label htmlFor={idSelect} className="sr-only">
                  Categoria do item {it.nItem}
                </label>
                <select
                  id={idSelect}
                  className="input truncate"
                  value={it.categoria.id}
                  disabled={salvando !== null}
                  onChange={(e) => onTrocar(it.nItem, e.target.value)}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({ROTULO_REDUCAO[c.reducao]})
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <SeloReducao reducao={it.categoria.reducao} />
                  <span>
                    CST <span className="font-medium text-ink">{it.ibsCbs.cst}</span>
                  </span>
                  <span>
                    cClassTrib <span className="font-medium text-ink">{it.ibsCbs.cClassTrib}</span>
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {salvando === it.nItem ? "Recalculando…" : ORIGEM[it.origem]}
                  {it.dica && it.conferir ? `. ${it.dica}` : ""}
                </p>
              </div>

              <dl className="grid grid-cols-4 gap-2 text-xs lg:contents">
                <Valor rotulo="Antigos" valor={it.tributosOriginais.total} apagado />
                <Valor rotulo="IBS" valor={it.ibsCbs.vIBS} />
                <Valor rotulo="CBS" valor={it.ibsCbs.cbs.valor} />
                <Valor rotulo={`Total ${ano}`} valor={it.totalNoAno} forte />
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Valor({ rotulo, valor, forte, apagado }: { rotulo: string; valor: number; forte?: boolean; apagado?: boolean }) {
  return (
    <div className="lg:text-right">
      <dt className="text-muted lg:sr-only">{rotulo}</dt>
      <dd className={`text-sm ${forte ? "font-semibold text-ink" : apagado ? "text-muted" : "text-ink"}`}>{brl(valor, 2)}</dd>
    </div>
  );
}
