/**
 * Impacto do split payment no caixa.
 *
 * Hoje a empresa recebe o tributo junto com o preço e só recolhe no mês
 * seguinte. Com o split payment o IBS/CBS é retido na liquidação financeira
 * (Pix, cartão, boleto), então essa "folga" de caixa acaba.
 *
 * Quem vende a prazo hoje às vezes recolhe ANTES de receber; para essas
 * empresas o split pode até melhorar o caixa.
 */

import { SELIC_ANUAL } from "./params";

export type EntradaSplit = {
  ibsCbsDebitoAnual: number;
  ibsCbsCreditoAnual: number;
  prazoMedioRecebimentoDias: number;
  /** Dias entre a venda média do mês e o vencimento da guia (≈ 15 + 25). */
  diasAteRecolhimento?: number;
  /** Atraso médio para o crédito ser reconhecido/devolvido no modelo simplificado. */
  diasRestituicaoCredito?: number;
  taxaJurosAnual?: number;
};

export type ResultadoSplit = {
  folgaAtualDias: number;
  /** Capital de giro adicional (positivo = precisa de mais caixa). */
  capitalGiroInteligente: number;
  capitalGiroSimplificado: number;
  custoFinanceiroAnualInteligente: number;
  custoFinanceiroAnualSimplificado: number;
};

export function impactoSplitPayment(e: EntradaSplit): ResultadoSplit {
  const diasRecolhimento = e.diasAteRecolhimento ?? 40;
  const diasCredito = e.diasRestituicaoCredito ?? 30;
  const juros = e.taxaJurosAnual ?? SELIC_ANUAL;

  const liquidoMensal = (e.ibsCbsDebitoAnual - e.ibsCbsCreditoAnual) / 12;
  const creditoMensal = e.ibsCbsCreditoAnual / 12;
  const folga = diasRecolhimento - e.prazoMedioRecebimentoDias;

  // Inteligente: retém só o líquido; a empresa perde a folga sobre ele
  const giroInteligente = (Math.max(liquidoMensal, 0) * folga) / 30;
  // Simplificado: retém o débito cheio; o crédito volta com atraso
  const giroSimplificado =
    giroInteligente + (creditoMensal * Math.max(folga + diasCredito, 0)) / 30;

  return {
    folgaAtualDias: folga,
    capitalGiroInteligente: giroInteligente,
    capitalGiroSimplificado: giroSimplificado,
    custoFinanceiroAnualInteligente: giroInteligente * juros,
    custoFinanceiroAnualSimplificado: giroSimplificado * juros,
  };
}
