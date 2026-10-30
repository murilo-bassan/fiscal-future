/**
 * Motor de simulação do impacto da Reforma Tributária para uma empresa.
 *
 * Modelo (anual, valores em R$):
 *  - R  = receita "por dentro" dos tributos antigos (ICMS/ISS/PIS/Cofins/IPI),
 *         sem IBS/CBS. IBS/CBS são cobrados "por fora", sobre R menos os
 *         tributos antigos (que não integram a base durante a transição).
 *  - Compras e despesas creditáveis: o valor bruto pago ao fornecedor é mantido
 *    constante; muda só quanto dele volta como crédito.
 *  - Lucro = R − tributos antigos líquidos + créditos de IBS/CBS − custos.
 *    (O débito de IBS/CBS é cobrado do cliente por fora e repassado ao fisco.)
 *
 * É um modelo de planejamento, não de apuração. Os resultados são estimativas.
 */

import {
  CREDITO_FORNECEDOR_SIMPLES,
  DEFAULT_CENARIO,
  PARTILHA_DAS,
  PIS_COFINS_CUMULATIVO,
  PIS_COFINS_NAO_CUMULATIVO,
  REDUCOES,
  TRANSICAO,
  type CenarioAliquota,
  type FaseTransicao,
  type Reducao,
} from "./params";

export type Atividade = "comercio" | "industria" | "servicos";
export type Regime = "simples" | "presumido" | "real";

export type PerfilEmpresa = {
  nome: string;
  regime: Regime;
  atividade: Atividade;
  receitaAnual: number;
  comprasAnuais: number; // mercadorias, matéria-prima, insumos
  despesasCreditaveis: number; // energia, aluguel, fretes, serviços de PJ etc.
  despesasNaoCreditaveis: number; // folha, pró-labore, tributos sobre renda etc.
  aliquotaIcmsVendas: number; // efetiva sobre a receita (fração)
  aliquotaIcmsCompras: number; // crédito médio de ICMS sobre compras
  aliquotaIss: number;
  aliquotaIpiVendas: number;
  aliquotaIpiCompras: number;
  aliquotaSimples: number; // alíquota efetiva do DAS
  reducaoVendas: Reducao;
  reducaoCompras: Reducao;
  percentualB2B: number; // fração da receita vendida a empresas
  percentualComprasSimples: number; // fração das compras feitas de optantes do Simples
  prazoMedioRecebimentoDias: number;
};

export type ResultadoAno = {
  ano: number;
  nota: string;
  aliquotaIbsCbs: number; // alíquota nominal sobre as vendas, já com redução
  tributosAntigos: number; // líquido de créditos
  ibsCbsDebito: number;
  ibsCbsCredito: number;
  ibsCbsLiquido: number;
  cargaTotal: number; // tributos sobre consumo efetivamente recolhidos
  /** Receita (sem IBS/CBS) necessária para manter o lucro atual. */
  receitaNecessaria: number;
  /** Quanto o consumidor final passa a pagar, por R$ 1 do preço atual. */
  precoConsumidorIndice: number;
  /** Custo líquido para um cliente PJ do lucro real, por R$ 1 do custo atual dele. */
  custoClientePJIndice: number;
  /** Lucro se a empresa mantiver o preço final ao consumidor e absorver a diferença. */
  lucroSemRepasse: number;
};

export type Simulacao = {
  perfil: PerfilEmpresa;
  cenario: CenarioAliquota;
  lucroAtual: number;
  cargaAtual: number;
  anos: ResultadoAno[];
  resumo: {
    variacaoCarga2027: number; // fração em relação à carga atual
    variacaoCarga2033: number;
    reajusteNecessario2027: number; // variação no preço ao consumidor
    reajusteNecessario2033: number;
    variacaoLucroSemRepasse2033: number; // fração do lucro atual
  };
};

const aliquotaComReducao = (aliquota: number, reducao: Reducao) =>
  aliquota * (1 - REDUCOES[reducao].reducao);

export function aliquotasDoAno(fase: FaseTransicao, cenario: CenarioAliquota) {
  const cbs = fase.cbs(cenario.cbs);
  const ibs = fase.ibs(cenario.ibs);
  return { cbs, ibs, total: cbs + ibs };
}

/** Débitos antigos como fração de R (ICMS/ISS/PIS/Cofins/IPI). */
function taxaDebitosAntigos(p: PerfilEmpresa, f: FaseTransicao): number {
  if (p.regime === "simples") return 0;
  const pisCofins = p.regime === "real" ? PIS_COFINS_NAO_CUMULATIVO : PIS_COFINS_CUMULATIVO;
  const icmsIss = p.atividade === "servicos" ? p.aliquotaIss : p.aliquotaIcmsVendas;
  const ipi = p.atividade === "industria" ? p.aliquotaIpiVendas : 0;
  return pisCofins * f.pisCofins + icmsIss * f.icmsIss + ipi * f.ipi;
}

/** Créditos antigos em R$. */
function creditosAntigos(p: PerfilEmpresa, f: FaseTransicao): number {
  if (p.regime === "simples") return 0;
  const pisCofins =
    p.regime === "real"
      ? PIS_COFINS_NAO_CUMULATIVO * (p.comprasAnuais + p.despesasCreditaveis) * f.pisCofins
      : 0;
  const icms =
    p.atividade === "servicos" ? 0 : p.aliquotaIcmsCompras * p.comprasAnuais * f.icmsIss;
  const ipi = p.atividade === "industria" ? p.aliquotaIpiCompras * p.comprasAnuais * f.ipi : 0;
  return pisCofins + icms + ipi;
}

/** Créditos de IBS/CBS sobre compras e despesas, em R$. */
export function creditosNovos(
  p: PerfilEmpresa,
  f: FaseTransicao,
  cenario: CenarioAliquota,
): number {
  if (f.ibsCbsCompensavel) return 0;
  const { total } = aliquotasDoAno(f, cenario);
  const base = p.comprasAnuais + p.despesasCreditaveis;
  const tCompras = aliquotaComReducao(total, p.reducaoCompras);
  const deRegulares = base * (1 - p.percentualComprasSimples) * (tCompras / (1 + tCompras));
  const fase = total / (cenario.cbs + cenario.ibs);
  const deSimples = base * p.percentualComprasSimples * CREDITO_FORNECEDOR_SIMPLES * fase;
  return deRegulares + deSimples;
}

/**
 * Crédito que um cliente PJ do lucro real aproveita, por R$ 1 pago à empresa
 * pelos tributos antigos (PIS/Cofins e ICMS destacados).
 */
function creditoClienteAntigo(p: PerfilEmpresa, f: FaseTransicao): number {
  const pisCofins = PIS_COFINS_NAO_CUMULATIVO * f.pisCofins;
  if (p.atividade === "servicos") return pisCofins;
  if (p.regime === "simples") {
    return pisCofins + p.aliquotaSimples * PARTILHA_DAS[p.atividade].icmsIss * f.icmsIss;
  }
  return pisCofins + p.aliquotaIcmsVendas * f.icmsIss;
}

/**
 * Crédito do cliente PJ ao comprar de um Simples puro, a partir de 2027: a CBS
 * embutida no DAS, mais o IBS e, para mercadorias, o ICMS que ainda resta.
 */
export function creditoClienteSimplesPuro(
  aliquotaSimples: number,
  atividade: Atividade,
  faseIbs: number,
  fatorIcmsIss: number,
): number {
  const partilha = PARTILHA_DAS[atividade];
  const parteIcmsIss = atividade === "servicos" ? faseIbs : Math.min(1, faseIbs + fatorIcmsIss);
  return aliquotaSimples * (partilha.pisCofins + partilha.icmsIss * parteIcmsIss);
}

function custosTotais(p: PerfilEmpresa) {
  return p.comprasAnuais + p.despesasCreditaveis + p.despesasNaoCreditaveis;
}

export function simular(p: PerfilEmpresa, cenario: CenarioAliquota = DEFAULT_CENARIO): Simulacao {
  if (p.regime === "simples") return simularSimplesPuro(p, cenario);

  const R0 = p.receitaAnual;
  const base = TRANSICAO[0]; // 2026 = situação atual (teste compensável)
  const cargaAtual = taxaDebitosAntigos(p, base) * R0 - creditosAntigos(p, base);
  const lucroAtual = R0 - cargaAtual - custosTotais(p);
  const custoClienteAtual = 1 - creditoClienteAntigo(p, base);

  const anos = TRANSICAO.map((f): ResultadoAno => {
    const { total } = aliquotasDoAno(f, cenario);
    const t = f.ibsCbsCompensavel ? 0 : aliquotaComReducao(total, p.reducaoVendas);
    const d = taxaDebitosAntigos(p, f);
    const credAntigo = creditosAntigos(p, f);
    const credNovo = creditosNovos(p, f, cenario);

    // Receita necessária para manter o lucro: R(1−d) = lucro + custos − créditos
    const R = (lucroAtual + custosTotais(p) - credAntigo - credNovo) / (1 - d);
    const debito = t * R * (1 - d);
    const tributosAntigos = d * R - credAntigo;
    const precoFinal = R + debito;

    // Sem repasse: preço final ao consumidor = R0, então R = R0 / (1 + t(1−d))
    const Rsem = R0 / (1 + t * (1 - d));
    const lucroSemRepasse = Rsem * (1 - d) + credAntigo + credNovo - custosTotais(p);

    // Cliente PJ: paga precoFinal, credita IBS/CBS integral e os tributos antigos que restam
    const custoCliente = precoFinal - debito - creditoClienteAntigo(p, f) * R;

    return {
      ano: f.ano,
      nota: f.nota,
      aliquotaIbsCbs: f.ibsCbsCompensavel
        ? aliquotaComReducao(total, p.reducaoVendas)
        : t,
      tributosAntigos,
      ibsCbsDebito: debito,
      ibsCbsCredito: credNovo,
      ibsCbsLiquido: debito - credNovo,
      cargaTotal: tributosAntigos + debito - credNovo,
      receitaNecessaria: R,
      precoConsumidorIndice: precoFinal / R0,
      custoClientePJIndice: custoCliente / R0 / custoClienteAtual,
      lucroSemRepasse,
    };
  });

  return montar(p, cenario, lucroAtual, cargaAtual, anos);
}

/** Optante do Simples que fica no DAS (sem regime regular de IBS/CBS). */
function simularSimplesPuro(p: PerfilEmpresa, cenario: CenarioAliquota): Simulacao {
  const R0 = p.receitaAnual;
  const das = p.aliquotaSimples * R0;
  const lucroAtual = R0 - das - custosTotais(p);
  const custoClienteAtual = 1 - creditoClienteAntigo(p, TRANSICAO[0]);

  const anos = TRANSICAO.map((f): ResultadoAno => {
    const { total, ibs } = aliquotasDoAno(f, cenario);
    // A partir de 2027 o cliente só credita o IBS/CBS embutido no DAS
    const faseIbs = f.ibsCbsCompensavel ? 0 : ibs / cenario.ibs;
    const creditoCliente = f.ibsCbsCompensavel
      ? creditoClienteAntigo(p, f)
      : creditoClienteSimplesPuro(p.aliquotaSimples, p.atividade, faseIbs, f.icmsIss);
    return {
      ano: f.ano,
      nota: f.nota,
      aliquotaIbsCbs: aliquotaComReducao(total, p.reducaoVendas),
      tributosAntigos: das,
      ibsCbsDebito: 0,
      ibsCbsCredito: 0,
      ibsCbsLiquido: 0,
      cargaTotal: das,
      receitaNecessaria: R0,
      precoConsumidorIndice: 1,
      custoClientePJIndice: (1 - creditoCliente) / custoClienteAtual,
      lucroSemRepasse: lucroAtual,
    };
  });

  return montar(p, cenario, lucroAtual, das, anos);
}

function montar(
  perfil: PerfilEmpresa,
  cenario: CenarioAliquota,
  lucroAtual: number,
  cargaAtual: number,
  anos: ResultadoAno[],
): Simulacao {
  const ano = (a: number) => anos.find((x) => x.ano === a)!;
  const variacao = (novo: number, velho: number) => (velho === 0 ? 0 : novo / velho - 1);
  return {
    perfil,
    cenario,
    lucroAtual,
    cargaAtual,
    anos,
    resumo: {
      variacaoCarga2027: variacao(ano(2027).cargaTotal, cargaAtual),
      variacaoCarga2033: variacao(ano(2033).cargaTotal, cargaAtual),
      reajusteNecessario2027: ano(2027).precoConsumidorIndice - 1,
      reajusteNecessario2033: ano(2033).precoConsumidorIndice - 1,
      variacaoLucroSemRepasse2033:
        lucroAtual === 0 ? 0 : ano(2033).lucroSemRepasse / lucroAtual - 1,
    },
  };
}
