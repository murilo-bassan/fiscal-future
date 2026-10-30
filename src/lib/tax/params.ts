/**
 * Parâmetros da transição da Reforma Tributária (EC 132/2023, LC 214/2025).
 *
 * As alíquotas de referência definitivas da CBS são fixadas por resolução do
 * Senado (prazo: 15/12/2026). Até lá, usamos estimativas públicas e deixamos o
 * usuário trocar o cenário. Atualize PRESETS quando os valores oficiais saírem.
 */

export type CenarioAliquota = {
  id: string;
  nome: string;
  cbs: number; // alíquota de referência da CBS (fração, ex. 0.088)
  ibs: number; // alíquota de referência do IBS (estadual + municipal)
  fonte: string;
};

export const PRESETS: CenarioAliquota[] = [
  {
    id: "governo-2024",
    nome: "Estimativa do governo (26,5%)",
    cbs: 0.088,
    ibs: 0.177,
    fonte: "Ministério da Fazenda, estimativa na tramitação da LC 214/2025",
  },
  {
    id: "cgibs-2026",
    nome: "Projeção CG-IBS (27,91%)",
    cbs: 0.0921,
    ibs: 0.187,
    fonte: "Comitê Gestor do IBS, projeção para 2033 (IBS 18,7%)",
  },
];

export const DEFAULT_CENARIO = PRESETS[0];

/** Fatores de cada tributo em cada ano (1 = cobrança integral). */
export type FaseTransicao = {
  ano: number;
  pisCofins: number; // 1 até 2026, 0 a partir de 2027
  ipi: number; // zerado a partir de 2027 (exceto produtos da ZFM, fora do escopo)
  icmsIss: number; // 1 até 2028, depois 0,9 / 0,8 / 0,7 / 0,6 / 0
  /** CBS: alíquota fixa em 2026 (teste), referência − 0,1 p.p. em 2027-28, cheia depois. */
  cbs: (ref: number) => number;
  /** IBS: 0,1% em 2026-28, depois fração da referência proporcional à saída de ICMS/ISS. */
  ibs: (ref: number) => number;
  /** Em 2026 o valor destacado é compensável com PIS/Cofins: custo líquido zero. */
  ibsCbsCompensavel: boolean;
  nota: string;
};

export const TRANSICAO: FaseTransicao[] = [
  {
    ano: 2026,
    pisCofins: 1,
    ipi: 1,
    icmsIss: 1,
    cbs: () => 0.009,
    ibs: () => 0.001,
    ibsCbsCompensavel: true,
    nota: "Ano de teste: CBS 0,9% e IBS 0,1% destacados e compensáveis com PIS/Cofins.",
  },
  {
    ano: 2027,
    pisCofins: 0,
    ipi: 0,
    icmsIss: 1,
    cbs: (ref) => Math.max(ref - 0.001, 0),
    ibs: () => 0.001,
    ibsCbsCompensavel: false,
    nota: "CBS entra integralmente, PIS/Cofins extintos, IPI zerado. Começa o Imposto Seletivo.",
  },
  {
    ano: 2028,
    pisCofins: 0,
    ipi: 0,
    icmsIss: 1,
    cbs: (ref) => Math.max(ref - 0.001, 0),
    ibs: () => 0.001,
    ibsCbsCompensavel: false,
    nota: "Igual a 2027.",
  },
  ...[2029, 2030, 2031, 2032].map((ano, i) => {
    const saida = (i + 1) / 10; // 10%, 20%, 30%, 40%
    return {
      ano,
      pisCofins: 0,
      ipi: 0,
      icmsIss: 1 - saida,
      cbs: (ref: number) => ref,
      ibs: (ref: number) => ref * saida,
      ibsCbsCompensavel: false,
      nota: `ICMS e ISS a ${Math.round((1 - saida) * 100)}% e IBS a ${Math.round(saida * 100)}% da referência.`,
    };
  }),
  {
    ano: 2033,
    pisCofins: 0,
    ipi: 0,
    icmsIss: 0,
    cbs: (ref) => ref,
    ibs: (ref) => ref,
    ibsCbsCompensavel: false,
    nota: "ICMS e ISS extintos. IBS e CBS integrais.",
  },
];

export const ANOS = TRANSICAO.map((t) => t.ano);

/** Reduções de alíquota previstas na LC 214/2025 (percentual de redução). */
export const REDUCOES = {
  padrao: { reducao: 0, nome: "Alíquota padrão" },
  reducao30: { reducao: 0.3, nome: "Redução de 30% (profissões regulamentadas)" },
  reducao40: { reducao: 0.4, nome: "Redução de 40% (bares, restaurantes, hotelaria, turismo, transporte intermunicipal)" },
  reducao60: { reducao: 0.6, nome: "Redução de 60% (saúde, educação, alimentos, insumos agro etc.)" },
  zero: { reducao: 1, nome: "Alíquota zero (cesta básica nacional, alguns medicamentos etc.)" },
} as const;

export type Reducao = keyof typeof REDUCOES;

/** PIS/Cofins atuais. */
export const PIS_COFINS_CUMULATIVO = 0.0365;
export const PIS_COFINS_NAO_CUMULATIVO = 0.0925;

/**
 * Crédito que um comprador aproveita ao comprar de fornecedor do Simples que
 * não optou pelo regime regular: só o IBS/CBS recolhido dentro do DAS.
 * Média aproximada; varia por anexo e faixa.
 */
export const CREDITO_FORNECEDOR_SIMPLES = 0.03;

/**
 * Parcela do DAS correspondente a tributos sobre consumo, aproximada a partir
 * das tabelas de partilha da LC 123/2006 (faixas intermediárias).
 */
export const PARTILHA_DAS = {
  comercio: { pisCofins: 0.155, icmsIss: 0.335, ipi: 0 },
  industria: { pisCofins: 0.155, icmsIss: 0.32, ipi: 0.075 },
  servicos: { pisCofins: 0.16, icmsIss: 0.325, ipi: 0 },
} as const;

/** Taxa usada para custo de oportunidade do caixa (Selic aproximada, a.a.). */
export const SELIC_ANUAL = 0.15;
