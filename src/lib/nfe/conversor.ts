/**
 * Converte uma NF-e/NFC-e antiga para o modelo da Reforma Tributária:
 *  - classifica cada item (CST e cClassTrib do IBS/CBS);
 *  - calcula o IBS/CBS que a mesma operação teria no ano escolhido;
 *  - compara com os tributos destacados na nota original;
 *  - gera o XML de referência com os grupos IBSCBS e IBSCBSTot.
 *
 * Nota autorizada não pode ser alterada: o resultado é uma referência para
 * configurar o ERP e emitir as próximas notas, não um documento fiscal.
 */

import { XMLBuilder } from "fast-xml-parser";
import { DEFAULT_CENARIO, TRANSICAO, type CenarioAliquota } from "../tax/params";
import { CATEGORIAS, CATEGORIA_PADRAO, buscarCategoria, type Categoria } from "../tax/categorias";
import { aliquotasNota, arred, baseIbsCbs, calcularIbsCbsItem, type IbsCbsItem } from "./calculo";
import type { NotaLida } from "./parser";

export type OrigemClassificacao = "usuario" | "nota" | "palavras-chave" | "padrao";

export type ItemConvertido = {
  nItem: number;
  descricao: string;
  ncm: string;
  cfop: string;
  valor: number; // vProd − vDesc
  categoria: Categoria;
  origem: OrigemClassificacao;
  conferir: boolean;
  tributosOriginais: { icms: number; pis: number; cofins: number; ipi: number; iss: number; total: number };
  /** Tributos antigos que ainda existem no ano escolhido. */
  tributosAntigosNoAno: number;
  ibsCbs: IbsCbsItem;
  /** Tributos sobre consumo destacados no ano escolhido (antigos restantes + IBS/CBS). */
  totalNoAno: number;
};

export type NotaConvertida = {
  nota: Omit<NotaLida, "bruto" | "itens">;
  ano: number;
  cenario: CenarioAliquota;
  itens: ItemConvertido[];
  totais: {
    base: number;
    cbs: number;
    ibsUf: number;
    ibsMun: number;
    ibs: number;
    ibsCbs: number;
    tributosOriginais: number;
    totalNoAno: number;
    variacao: number; // fração
  };
  avisos: string[];
  xml: string;
};

export type OpcoesConversao = {
  ano?: number;
  cenario?: CenarioAliquota;
  /** Escolhas do usuário (ou da IA) por número do item: id da categoria. */
  classificacoes?: Record<number, string>;
};

function classificar(
  item: NotaLida["itens"][number],
  escolha: string | undefined,
): { categoria: Categoria; origem: OrigemClassificacao; conferir: boolean } {
  const porId = escolha ? CATEGORIAS.find((c) => c.id === escolha) : undefined;
  if (porId) return { categoria: porId, origem: "usuario", conferir: false };

  if (item.ibsCbsOriginal) {
    const c = CATEGORIAS.find((x) => x.cClassTrib === item.ibsCbsOriginal!.cClassTrib);
    if (c) return { categoria: c, origem: "nota", conferir: false };
  }

  const achadas = buscarCategoria(item.descricao).filter((c) => c.id !== "padrao");
  // Palavra-chave nunca confirma o enquadramento: o NCM precisa estar no anexo da lei
  if (achadas.length) return { categoria: achadas[0], origem: "palavras-chave", conferir: true };
  return { categoria: CATEGORIA_PADRAO, origem: "padrao", conferir: true };
}

export function converterNota(nota: NotaLida, opcoes: OpcoesConversao = {}): NotaConvertida {
  const cenario = opcoes.cenario ?? DEFAULT_CENARIO;
  const aliq = aliquotasNota(opcoes.ano ?? 2026, cenario);
  const fase = TRANSICAO.find((t) => t.ano === aliq.ano)!;

  const itens = nota.itens.map((it): ItemConvertido => {
    const { categoria, origem, conferir } = classificar(it, opcoes.classificacoes?.[it.nItem]);
    const restantes = {
      icms: it.icms * fase.icmsIss,
      pis: it.pis * fase.pisCofins,
      cofins: it.cofins * fase.pisCofins,
      ipi: it.ipi * fase.ipi,
      iss: it.iss * fase.icmsIss,
    };
    const base = baseIbsCbs({
      valor: it.valor,
      frete: it.frete,
      seguro: it.seguro,
      outros: it.outros,
      desconto: it.desconto,
      ...restantes,
    });
    const ibsCbs = calcularIbsCbsItem(base, categoria, aliq);
    const antigosNoAno = arred(restantes.icms + restantes.pis + restantes.cofins + restantes.ipi + restantes.iss);
    const originais = arred(it.icms + it.pis + it.cofins + it.ipi + it.iss);
    return {
      nItem: it.nItem,
      descricao: it.descricao,
      ncm: it.ncm,
      cfop: it.cfop,
      valor: arred(it.valor - it.desconto),
      categoria,
      origem,
      conferir,
      tributosOriginais: { icms: it.icms, pis: it.pis, cofins: it.cofins, ipi: it.ipi, iss: it.iss, total: originais },
      tributosAntigosNoAno: antigosNoAno,
      ibsCbs,
      // Em 2026 o IBS/CBS é compensado com PIS/Cofins: não aumenta o total
      totalNoAno: arred(antigosNoAno + (aliq.compensavel ? 0 : ibsCbs.total)),
    };
  });

  const soma = (f: (i: ItemConvertido) => number) => arred(itens.reduce((s, i) => s + f(i), 0));
  const tributosOriginais = soma((i) => i.tributosOriginais.total);
  const totalNoAno = soma((i) => i.totalNoAno);
  const totais = {
    base: soma((i) => i.ibsCbs.base),
    cbs: soma((i) => i.ibsCbs.cbs.valor),
    ibsUf: soma((i) => i.ibsCbs.ibsUf.valor),
    ibsMun: soma((i) => i.ibsCbs.ibsMun.valor),
    ibs: soma((i) => i.ibsCbs.vIBS),
    ibsCbs: soma((i) => i.ibsCbs.total),
    tributosOriginais,
    totalNoAno,
    variacao: tributosOriginais ? totalNoAno / tributosOriginais - 1 : 0,
  };

  const avisos: string[] = [
    "Referência para configurar o ERP e as próximas notas. Uma nota já autorizada não pode ser alterada, e o XML gerado não tem assinatura nem validade fiscal.",
  ];
  if (["1", "2", "4"].includes(nota.crt)) {
    avisos.push(
      "O emitente é do Simples Nacional. No Simples puro o IBS/CBS é recolhido dentro do DAS; os valores calculados aqui valem se a empresa optar pelo regime regular (Simples híbrido).",
    );
  }
  if (aliq.compensavel) {
    avisos.push("Em 2026 o IBS e a CBS são destacados na nota, mas compensados com PIS/Cofins: não aumentam o valor a pagar.");
  }
  if (aliq.ano >= 2029) {
    avisos.push("A partir de 2029 a divisão do IBS entre estado e município é uma estimativa; o total do IBS não muda.");
  }
  const aConferir = itens.filter((i) => i.conferir).length;
  if (aConferir) {
    avisos.push(`${aConferir} ${aConferir === 1 ? "item precisa" : "itens precisam"} de conferência da classificação (confirme se o NCM está no anexo da LC 214/2025).`);
  }

  const { bruto: _bruto, itens: _itens, ...cabecalho } = nota;
  void _bruto;
  void _itens;

  return { nota: cabecalho, ano: aliq.ano, cenario, itens, totais, avisos, xml: gerarXml(nota, itens, totais) };
}

// ---------------------------------------------------------------------------
// XML no layout da NT 2025.002

const v2 = (n: number) => arred(n).toFixed(2);
const p4 = (fracao: number) => (fracao * 100).toFixed(4);

function grupoParcela(prefixo: "IBSUF" | "IBSMun" | "CBS", p: IbsCbsItem["cbs"]) {
  const g: Record<string, unknown> = { [`p${prefixo}`]: p4(p.aliquota) };
  if (p.reducao > 0) g.gRed = { pRedAliq: p4(p.reducao), pAliqEfet: p4(p.aliquotaEfetiva) };
  g[`v${prefixo}`] = v2(p.valor);
  return g;
}

export function grupoIBSCBS(t: IbsCbsItem): Record<string, unknown> {
  const g: Record<string, unknown> = { CST: t.cst, cClassTrib: t.cClassTrib };
  if (t.temGrupo) {
    g.gIBSCBS = {
      vBC: v2(t.base),
      gIBSUF: grupoParcela("IBSUF", t.ibsUf),
      gIBSMun: grupoParcela("IBSMun", t.ibsMun),
      vIBS: v2(t.vIBS),
      gCBS: grupoParcela("CBS", t.cbs),
    };
  }
  return g;
}

export function grupoIBSCBSTot(t: { base: number; ibsUf: number; ibsMun: number; ibs: number; cbs: number }) {
  const zero = v2(0);
  return {
    vBCIBSCBS: v2(t.base),
    gIBS: {
      gIBSUF: { vDif: zero, vDevTrib: zero, vIBSUF: v2(t.ibsUf) },
      gIBSMun: { vDif: zero, vDevTrib: zero, vIBSMun: v2(t.ibsMun) },
      vIBS: v2(t.ibs),
      vCredPres: zero,
      vCredPresCondSus: zero,
    },
    gCBS: { vDif: zero, vDevTrib: zero, vCBS: v2(t.cbs), vCredPres: zero, vCredPresCondSus: zero },
  };
}

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
  processEntities: true,
});

function gerarXml(
  nota: NotaLida,
  itens: ItemConvertido[],
  totais: NotaConvertida["totais"],
): string {
  const nfe = structuredClone(nota.bruto) as Record<string, Record<string, unknown>>;
  const inf = nfe.infNFe as Record<string, unknown>;
  const porItem = new Map(itens.map((i) => [i.nItem, i]));
  for (const det of (inf.det as Record<string, Record<string, unknown>>[]) ?? []) {
    const it = porItem.get(Number(det["@_nItem"]));
    if (!it) continue;
    const imposto = (det.imposto ?? {}) as Record<string, unknown>;
    delete imposto.IBSCBS;
    imposto.IBSCBS = grupoIBSCBS(it.ibsCbs);
    det.imposto = imposto;
  }
  const total = (inf.total ?? {}) as Record<string, unknown>;
  delete total.IBSCBSTot;
  total.IBSCBSTot = grupoIBSCBSTot(totais);
  inf.total = total;

  const corpo = builder.build({ NFe: nfe }) as string;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    "<!-- Referência gerada pelo ZeroAbi no layout da NT 2025.002 (IBS/CBS). Sem assinatura: não é documento fiscal. -->\n" +
    corpo
  );
}
