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
      // O IPI fica fora: não está no valor do produto nem é deduzido da base (NT 2025.002)
      icms: restantes.icms,
      pis: restantes.pis,
      cofins: restantes.cofins,
      iss: restantes.iss,
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
  if (aliq.ano >= 2027) {
    avisos.push(
      "No XML de referência, os grupos de ICMS, IPI, PIS e Cofins ficam como na nota original. PIS, Cofins e IPI deixam de ser cobrados em 2027, e o ICMS, em 2033; ajuste também esse cadastro no ERP.",
    );
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
  if (nota.modelo === "nfse") return gerarXmlServico(nota, itens, totais);
  const nfe = structuredClone(nota.bruto ?? montarBruto(nota)) as Record<string, Record<string, unknown>>;
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
  return cabecalhoXml(nota) + corpo;
}

function cabecalhoXml(nota: NotaLida) {
  const origem =
    nota.fonte === "xml"
      ? ""
      : " Montada a partir de dados digitados, extraídos de documento ou de planilha: confira com a nota original.";
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<!-- Referência gerada pelo Fiscal Future no layout da NT 2025.002 (IBS/CBS). Sem assinatura: não é documento fiscal.${origem} -->\n`
  );
}

const documento = (d: string) => (d.length === 11 ? { CPF: d } : d ? { CNPJ: d } : {});

/**
 * NF-e/NFC-e sem XML original: monta a estrutura mínima (identificação,
 * participantes, produtos e totais). Os grupos de ICMS/PIS/Cofins não são
 * recriados, porque os CSTs da nota antiga não são conhecidos.
 */
function montarBruto(nota: NotaLida): Record<string, unknown> {
  const d = nota.destinatario;
  return {
    "@_xmlns": "http://www.portalfiscal.inf.br/nfe",
    infNFe: {
      "@_versao": "4.00",
      ...(nota.chave ? { "@_Id": `NFe${nota.chave}` } : {}),
      ide: { natOp: nota.naturezaOperacao, mod: nota.modelo, serie: nota.serie, nNF: nota.numero, dhEmi: nota.emissao },
      emit: {
        ...documento(nota.emitente.documento),
        xNome: nota.emitente.nome,
        enderEmit: { UF: nota.emitente.uf },
        CRT: nota.crt,
      },
      ...(d ? { dest: { ...documento(d.documento), xNome: d.nome, enderDest: { UF: d.uf } } } : {}),
      det: nota.itens.map((it) => ({
        "@_nItem": String(it.nItem),
        prod: {
          cProd: it.codigo,
          xProd: it.descricao,
          NCM: it.ncm,
          CFOP: it.cfop,
          uCom: it.unidade,
          qCom: it.quantidade.toFixed(4),
          vUnCom: it.valorUnitario.toFixed(4),
          vProd: v2(it.valor),
          ...(it.desconto ? { vDesc: v2(it.desconto) } : {}),
        },
        imposto: {},
      })),
      total: {
        ICMSTot: {
          vICMS: v2(nota.totais.icms),
          vProd: v2(nota.totais.produtos),
          vDesc: v2(nota.totais.desconto),
          vIPI: v2(nota.totais.ipi),
          vPIS: v2(nota.totais.pis),
          vCOFINS: v2(nota.totais.cofins),
          vNF: v2(nota.totais.nota),
        },
      },
    },
  };
}

/**
 * NFS-e: não existe um XML antigo único (cada prefeitura tinha o seu layout).
 * Geramos uma referência simples com os valores do serviço e o grupo IBS/CBS
 * por item, para conferência e cadastro.
 */
function gerarXmlServico(nota: NotaLida, itens: ItemConvertido[], totais: NotaConvertida["totais"]): string {
  const porItem = new Map(itens.map((i) => [i.nItem, i]));
  const corpo = builder.build({
    NFSeReferencia: {
      infNFSe: {
        nNFSe: nota.numero,
        dhEmi: nota.emissao,
        prest: {
          ...documento(nota.emitente.documento),
          xNome: nota.emitente.nome,
          regime: nota.crt === "3" ? "normal" : "simples",
        },
        ...(nota.destinatario
          ? { toma: { ...documento(nota.destinatario.documento), xNome: nota.destinatario.nome } }
          : {}),
        servicos: {
          servico: nota.itens.map((it) => ({
            "@_nItem": String(it.nItem),
            xDescServ: it.descricao,
            cServ: it.codigoServico ?? "",
            vServ: v2(it.valor),
            ...(it.desconto ? { vDesc: v2(it.desconto) } : {}),
            vISS: v2(it.iss),
            IBSCBS: grupoIBSCBS(porItem.get(it.nItem)!.ibsCbs),
          })),
        },
        IBSCBSTot: grupoIBSCBSTot(totais),
      },
    },
  }) as string;
  return cabecalhoXml(nota) + corpo;
}
