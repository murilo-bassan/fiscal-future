/**
 * Optante do Simples Nacional: ficar no DAS ("Simples puro") ou recolher
 * IBS/CBS pelo regime regular ("Simples híbrido", opção semestral a partir de 2027)?
 *
 * Comparação em paridade de preço para o cliente:
 *  - Cliente PJ: no híbrido ele credita todo o IBS/CBS, então a empresa pode
 *    cobrar um preço líquido que deixe o custo dele igual ao do Simples puro.
 *  - Consumidor final: não credita nada, então o preço final fica igual e o
 *    IBS/CBS sai da margem da empresa.
 */

import {
  aliquotasDoAno,
  creditoClienteSimplesPuro,
  creditosNovos,
  type PerfilEmpresa,
} from "./engine";
import {
  DEFAULT_CENARIO,
  PARTILHA_DAS,
  PIS_COFINS_NAO_CUMULATIVO,
  REDUCOES,
  TRANSICAO,
  type CenarioAliquota,
} from "./params";

export type ComparacaoSimplesAno = {
  ano: number;
  lucroPuro: number;
  lucroHibrido: number;
  dasPuro: number;
  dasHibrido: number;
  ibsCbsLiquidoHibrido: number;
  /** Crédito que o cliente PJ aproveita no Simples puro, por R$ 1 de compra. */
  creditoClientePuro: number;
  /** Crédito por R$ 1 que o cliente PJ aproveitava em 2026 (PIS/Cofins + ICMS). */
  creditoClienteHoje: number;
};

export type ComparacaoSimples = {
  anos: ComparacaoSimplesAno[];
  recomendacao2027: "puro" | "hibrido";
  recomendacao2033: "puro" | "hibrido";
  ganhoAnualHibrido2027: number;
  ganhoAnualHibrido2033: number;
  /** Receita B2B mínima (fração) a partir da qual o híbrido compensa em 2033. */
  pontoDeVirada2033: number | null;
  explicacao: string[];
};

function lucroHibrido(
  p: PerfilEmpresa,
  ano: number,
  cenario: CenarioAliquota,
  percentualB2B: number,
) {
  const f = TRANSICAO.find((t) => t.ano === ano)!;
  const { total, ibs } = aliquotasDoAno(f, cenario);
  const t = total * (1 - REDUCOES[p.reducaoVendas].reducao);
  const partilha = PARTILHA_DAS[p.atividade];
  const faseIbs = ibs / cenario.ibs;
  const s = p.aliquotaSimples;
  const custos = p.comprasAnuais + p.despesasCreditaveis + p.despesasNaoCreditaveis;
  const R = p.receitaAnual;

  // Crédito que o cliente PJ teria no Simples puro neste ano
  const creditoPuro = creditoClienteSimplesPuro(s, p.atividade, faseIbs, f.icmsIss);

  const receitaB2B = R * percentualB2B * (1 - creditoPuro);
  const receitaB2C = (R * (1 - percentualB2B)) / (1 + t);
  const receitaLiquida = receitaB2B + receitaB2C;

  // No híbrido o DAS perde a parcela de PIS/Cofins e a parte do ICMS/ISS já substituída pelo IBS
  const fatorDas = 1 - partilha.pisCofins - partilha.icmsIss * (1 - f.icmsIss);
  const das = s * receitaLiquida * fatorDas;
  const credito = creditosNovos(p, f, cenario);
  const debito = t * receitaLiquida;

  return {
    lucro: receitaLiquida - das + credito - custos,
    das,
    ibsCbsLiquido: debito - credito,
    creditoPuro,
  };
}

export function compararSimples(
  p: PerfilEmpresa,
  cenario: CenarioAliquota = DEFAULT_CENARIO,
): ComparacaoSimples {
  const R = p.receitaAnual;
  const custos = p.comprasAnuais + p.despesasCreditaveis + p.despesasNaoCreditaveis;
  const dasPuro = p.aliquotaSimples * R;
  const lucroPuro = R - dasPuro - custos;
  const partilha = PARTILHA_DAS[p.atividade];
  const creditoClienteHoje =
    PIS_COFINS_NAO_CUMULATIVO + (p.atividade === "servicos" ? 0 : p.aliquotaSimples * partilha.icmsIss);

  const anos = TRANSICAO.filter((f) => f.ano >= 2027).map((f): ComparacaoSimplesAno => {
    const h = lucroHibrido(p, f.ano, cenario, p.percentualB2B);
    return {
      ano: f.ano,
      lucroPuro,
      lucroHibrido: h.lucro,
      dasPuro,
      dasHibrido: h.das,
      ibsCbsLiquidoHibrido: h.ibsCbsLiquido,
      creditoClientePuro: h.creditoPuro,
      creditoClienteHoje,
    };
  });

  const a27 = anos.find((a) => a.ano === 2027)!;
  const a33 = anos.find((a) => a.ano === 2033)!;
  const ganho27 = a27.lucroHibrido - a27.lucroPuro;
  const ganho33 = a33.lucroHibrido - a33.lucroPuro;

  // Busca do ponto de virada por bisseção (lucro híbrido é crescente na fatia B2B)
  const diff = (b2b: number) => lucroHibrido(p, 2033, cenario, b2b).lucro - lucroPuro;
  let pontoDeVirada: number | null = null;
  if (diff(0) >= 0) pontoDeVirada = 0;
  else if (diff(1) >= 0) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (diff(mid) >= 0) hi = mid;
      else lo = mid;
    }
    pontoDeVirada = hi;
  }

  const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
  const explicacao = [
    `Hoje um cliente PJ do lucro real credita cerca de ${pct(creditoClienteHoje)} do que compra de você (PIS/Cofins${p.atividade === "servicos" ? "" : " e ICMS"}).`,
    `A partir de 2027, se você continuar só no DAS, esse crédito cai para cerca de ${pct(a27.creditoClientePuro)}. Seus clientes PJ passam a ter motivo para comprar de concorrentes no regime regular.`,
    p.percentualB2B >= 0.5
      ? `Como ${pct(p.percentualB2B)} da sua receita vem de empresas, o regime regular de IBS/CBS tende a preservar a sua competitividade.`
      : `Como a maior parte da sua receita vem de consumidores finais (que não creditam imposto), o Simples puro tende a ser mais vantajoso.`,
  ];
  if (pontoDeVirada !== null && pontoDeVirada > 0) {
    explicacao.push(
      `Com a sua estrutura de custos, o híbrido passa a valer a pena quando mais de ${pct(pontoDeVirada)} da receita é B2B.`,
    );
  }

  return {
    anos,
    recomendacao2027: ganho27 > 0 ? "hibrido" : "puro",
    recomendacao2033: ganho33 > 0 ? "hibrido" : "puro",
    ganhoAnualHibrido2027: ganho27,
    ganhoAnualHibrido2033: ganho33,
    pontoDeVirada2033: pontoDeVirada,
    explicacao,
  };
}
