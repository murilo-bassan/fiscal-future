/**
 * Cálculo dos tributos de um rascunho de nota no ano da emissão. É o mesmo
 * cálculo exibido no formulário e enviado ao provedor: o usuário vê
 * exatamente o que vai na nota.
 */

import { DEFAULT_CENARIO, type CenarioAliquota } from "../tax/params";
import { categoriaPorId } from "../tax/categorias";
import { aliquotasNota, arred, baseIbsCbs, calcularIbsCbsItem, type IbsCbsItem } from "../nfe/calculo";
import type { EmitenteFiscal, RascunhoNota } from "./tipos";

/** PIS/Cofins por regime (cumulativo no presumido, não cumulativo no real). */
const PIS_COFINS = {
  presumido: { pis: 0.0065, cofins: 0.03 },
  real: { pis: 0.0165, cofins: 0.076 },
} as const;

export type CalculoItem = {
  valor: number; // quantidade × unitário − desconto
  icms: number;
  pis: number;
  cofins: number;
  iss: number;
  ibsCbs: IbsCbsItem;
};

export type CalculoRascunho = {
  ano: number;
  itens: CalculoItem[];
  totais: {
    produtos: number;
    desconto: number;
    icms: number;
    pis: number;
    cofins: number;
    iss: number;
    base: number;
    cbs: number;
    ibsUf: number;
    ibsMun: number;
    ibs: number;
    ibsCbs: number;
    /** Total tradicional da nota (vNF): produtos − descontos. */
    nota: number;
    /**
     * Quanto o cliente paga com o IBS/CBS por fora (a partir de 2027, emitente
     * do regime regular). Em 2026 o destaque é informativo e não soma.
     */
    notaComIbsCbs: number;
  };
  /** O emitente do Simples puro não destaca IBS/CBS por fora. */
  simples: boolean;
};

export function calcularRascunho(
  emitente: Pick<EmitenteFiscal, "crt" | "regime" | "aliquotaIssPadrao">,
  r: RascunhoNota,
  opcoes: { ano?: number; cenario?: CenarioAliquota } = {},
): CalculoRascunho {
  const aliq = aliquotasNota(opcoes.ano ?? new Date().getFullYear(), opcoes.cenario ?? DEFAULT_CENARIO);
  const simples = emitente.crt !== "3";
  const temPisCofins = aliq.ano <= 2026 && !simples && emitente.regime !== "simples";
  const pc = temPisCofins ? PIS_COFINS[emitente.regime as "presumido" | "real"] : { pis: 0, cofins: 0 };

  const itens = r.itens.map((it): CalculoItem => {
    const bruto = arred(it.quantidade * it.valorUnitario);
    const valor = arred(bruto - it.desconto);
    const icms = r.tipo === "nfe" && !simples ? arred(valor * (it.aliquotaIcms ?? 0)) : 0;
    const iss = r.tipo === "nfse" && aliq.ano < 2033 ? arred(valor * (emitente.aliquotaIssPadrao ?? 0)) : 0;
    const pis = arred(valor * pc.pis);
    const cofins = arred(valor * pc.cofins);
    const base = baseIbsCbs({ valor: bruto, desconto: it.desconto, icms, pis, cofins, iss });
    return { valor, icms, pis, cofins, iss, ibsCbs: calcularIbsCbsItem(base, categoriaPorId(it.categoriaId), aliq) };
  });

  const soma = (f: (i: CalculoItem) => number) => arred(itens.reduce((s, i) => s + f(i), 0));
  const produtos = arred(r.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0));
  const desconto = arred(r.itens.reduce((s, i) => s + i.desconto, 0));
  const ibsCbs = soma((i) => i.ibsCbs.total);
  return {
    ano: aliq.ano,
    itens,
    totais: {
      produtos,
      desconto,
      icms: soma((i) => i.icms),
      pis: soma((i) => i.pis),
      cofins: soma((i) => i.cofins),
      iss: soma((i) => i.iss),
      base: soma((i) => i.ibsCbs.base),
      cbs: soma((i) => i.ibsCbs.cbs.valor),
      ibsUf: soma((i) => i.ibsCbs.ibsUf.valor),
      ibsMun: soma((i) => i.ibsCbs.ibsMun.valor),
      ibs: soma((i) => i.ibsCbs.vIBS),
      ibsCbs,
      nota: arred(produtos - desconto),
      notaComIbsCbs: arred(produtos - desconto + (aliq.compensavel || simples ? 0 : ibsCbs)),
    },
    simples,
  };
}
