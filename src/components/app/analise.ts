/**
 * Junta tudo o que o painel e o relatório mostram a partir de perfil + cenário.
 * Sem efeitos colaterais; não altera o motor (src/lib/tax).
 */

import {
  compararSimples,
  impactoSplitPayment,
  simular,
  type CenarioAliquota,
  type PerfilEmpresa,
  type ResultadoSplit,
} from "@/lib/tax";
import { brl, pct, pctSinal } from "./formato";

export type Analise = ReturnType<typeof analisar>;

export function analisar(perfil: PerfilEmpresa, cenario: CenarioAliquota) {
  const sim = simular(perfil, cenario);
  const ano = (a: number) => sim.anos.find((x) => x.ano === a)!;
  const a27 = ano(2027);
  const a33 = ano(2033);
  const simples = perfil.regime === "simples";
  const comparacao = simples ? compararSimples(perfil, cenario) : null;

  let split: { a27: ResultadoSplit; a33: ResultadoSplit } | null = null;
  if (!simples) {
    const calc = (a: typeof a27) =>
      impactoSplitPayment({
        ibsCbsDebitoAnual: a.ibsCbsDebito,
        ibsCbsCreditoAnual: a.ibsCbsCredito,
        prazoMedioRecebimentoDias: perfil.prazoMedioRecebimentoDias,
      });
    split = { a27: calc(a27), a33: calc(a33) };
  }

  return { perfil, cenario, sim, a27, a33, simples, comparacao, split };
}

type Verbo = "sobe" | "cai" | "igual";
const verbo = (x: number): Verbo => (Math.abs(x) < 0.0005 ? "igual" : x > 0 ? "sobe" : "cai");
const VERBOS: Record<Verbo, string> = { sobe: "precisa subir", cai: "pode cair", igual: "pode ficar igual" };

/**
 * "precisa subir 3,1% em 2027 e 7,5% em 2033"
 * "pode cair 1,9% em 2027 e precisa subir 7,3% em 2033"
 */
export function mudancaPreco(x27: number, x33: number) {
  const v27 = verbo(x27);
  const v33 = verbo(x33);
  const num = (x: number) => pct(Math.abs(x));
  const parte27 = v27 === "igual" ? `${VERBOS.igual} em 2027` : `${VERBOS[v27]} ${num(x27)} em 2027`;
  if (v33 === "igual") return `${parte27} e ficar igual em 2033`;
  if (v33 === v27) return `${parte27} e ${num(x33)} em 2033`;
  return `${parte27} e ${VERBOS[v33]} ${num(x33)} em 2033`;
}

/** Frases diretas do topo do painel e do sumário executivo. */
export function respostas(a: Analise): { titulo: string; frases: string[] } {
  const { sim, a33, comparacao, perfil } = a;
  if (a.simples && comparacao) {
    const c = comparacao;
    const caminho = (r: "puro" | "hibrido") =>
      r === "puro" ? "continuar no Simples puro" : "recolher IBS e CBS por fora (Simples híbrido)";
    const frases = [
      `Em 2027, o melhor caminho é ${caminho(c.recomendacao2027)}: ${brl(Math.abs(c.ganhoAnualHibrido2027))} por ano a mais de lucro do que a outra opção.`,
      c.recomendacao2033 === c.recomendacao2027
        ? `Em 2033 a recomendação se mantém, com diferença de ${brl(Math.abs(c.ganhoAnualHibrido2033))} por ano.`
        : `Em 2033 a recomendação muda: o melhor passa a ser ${caminho(c.recomendacao2033)}, com diferença de ${brl(Math.abs(c.ganhoAnualHibrido2033))} por ano.`,
    ];
    const custoPJ = a33.custoClientePJIndice - 1;
    if (perfil.percentualB2B > 0 && custoPJ > 0.0005) {
      frases.push(
        `No Simples puro, comprar de você fica ${pct(custoPJ)} mais caro para um cliente empresa do lucro real em 2033, porque ele aproveita menos crédito.`,
      );
    }
    return {
      titulo: `No Simples puro, o seu imposto continua o mesmo: ${brl(sim.cargaAtual)} por ano no DAS. O que muda é o crédito que os seus clientes empresa aproveitam.`,
      frases,
    };
  }

  const r = sim.resumo;
  const frases: string[] = [];
  if (sim.lucroAtual > 0) {
    frases.push(
      `Se você mantiver o preço de hoje, o lucro anual passa de ${brl(sim.lucroAtual)} para ${brl(a33.lucroSemRepasse)} em 2033 (${pctSinal(r.variacaoLucroSemRepasse2033)}).`,
    );
  } else {
    frases.push(
      `Com os números informados, a empresa hoje opera no prejuízo (${brl(sim.lucroAtual)} por ano). Os reajustes acima mantêm esse resultado; confira os números com o seu contador.`,
    );
  }
  frases.push(
    `Os impostos sobre consumo que você recolhe vão de ${brl(sim.cargaAtual)} por ano hoje para ${brl(a33.cargaTotal)} em 2033 (${pctSinal(r.variacaoCarga2033)}), já com o preço reajustado.`,
  );
  return {
    titulo: `Para manter o seu lucro, o preço ao consumidor ${mudancaPreco(r.reajusteNecessario2027, r.reajusteNecessario2033)}.`,
    frases,
  };
}

/** Lista curta de próximos passos para o relatório. */
export function recomendacoes(a: Analise): string[] {
  const { perfil, sim, comparacao, split } = a;
  const out: string[] = [];
  if (a.simples && comparacao) {
    const c = comparacao;
    out.push(
      c.recomendacao2027 === "hibrido"
        ? `Avalie com o contador a opção pelo regime regular de IBS/CBS (Simples híbrido) para 2027. Ganho estimado: ${brl(c.ganhoAnualHibrido2027)} por ano.`
        : `Para 2027, permanecer no Simples puro parece mais vantajoso (${brl(-c.ganhoAnualHibrido2027)} por ano a mais de lucro).`,
    );
    if (c.recomendacao2033 !== c.recomendacao2027) {
      out.push(
        `Reavalie a escolha ao longo da transição: em 2033 a melhor opção muda para ${c.recomendacao2033 === "hibrido" ? "o Simples híbrido" : "o Simples puro"}. A opção é semestral.`,
      );
    } else {
      out.push("A opção pelo regime regular é feita por semestre. Refaça esta simulação antes de cada prazo de opção.");
    }
    if (perfil.percentualB2B > 0) {
      const a27 = c.anos.find((x) => x.ano === 2027)!;
      out.push(
        `Converse com os seus clientes empresa: o crédito que eles aproveitam ao comprar de você cai de cerca de ${pct(a27.creditoClienteHoje)} hoje para ${pct(a27.creditoClientePuro)} em 2027 no Simples puro.`,
      );
    }
    if (c.pontoDeVirada2033 !== null && c.pontoDeVirada2033 > 0) {
      out.push(
        `Acompanhe a fatia de vendas para empresas: acima de ${pct(c.pontoDeVirada2033)} da receita, o híbrido passa a compensar em 2033.`,
      );
    }
  } else {
    const r = sim.resumo;
    if (r.reajusteNecessario2027 > 0.0005) {
      out.push(
        `Prepare a tabela de preços de 2027: um reajuste de cerca de ${pct(r.reajusteNecessario2027)} ao consumidor mantém o lucro atual.`,
      );
    } else if (r.reajusteNecessario2027 < -0.0005) {
      out.push(
        `Em 2027 há espaço para reduzir o preço ao consumidor em até ${pct(-r.reajusteNecessario2027)} sem perder lucro: pode ser uma vantagem contra concorrentes.`,
      );
    }
    out.push(
      `Revise contratos de longo prazo para prever reajuste por mudança tributária. Até 2033 o preço necessário varia ${pctSinal(r.reajusteNecessario2033)} em relação a hoje.`,
    );
    if (split && split.a27.capitalGiroInteligente > 0) {
      out.push(
        `Reserve capital de giro para o split payment: cerca de ${brl(split.a27.capitalGiroInteligente)} em 2027 e ${brl(split.a33.capitalGiroInteligente)} em 2033 (podendo chegar a ${brl(split.a33.capitalGiroSimplificado)} no modelo simplificado).`,
      );
    }
    if (perfil.percentualComprasSimples > 0) {
      out.push(
        `Reveja fornecedores do Simples (${pct(perfil.percentualComprasSimples)} das compras): eles geram bem menos crédito de IBS/CBS que fornecedores do regime regular.`,
      );
    }
  }
  out.push(
    "Confirme se os seus produtos e serviços têm alíquota padrão ou reduzida. A classificação muda bastante o resultado.",
  );
  return out;
}

