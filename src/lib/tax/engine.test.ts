import { describe, expect, it } from "vitest";
import {
  PERFIL_EXEMPLO,
  buscarCategoria,
  compararSimples,
  impactoSplitPayment,
  perfilSchema,
  simular,
  type PerfilEmpresa,
} from "./index";

const servicoSimples: PerfilEmpresa = {
  ...PERFIL_EXEMPLO,
  nome: "Agência",
  regime: "simples",
  atividade: "servicos",
  receitaAnual: 1_200_000,
  comprasAnuais: 0,
  despesasCreditaveis: 150_000,
  despesasNaoCreditaveis: 700_000,
  aliquotaIss: 0.03,
  aliquotaSimples: 0.11,
};

describe("simular (regime regular)", () => {
  const sim = simular(PERFIL_EXEMPLO);

  it("2026 reproduz a situação atual", () => {
    const a = sim.anos[0];
    expect(a.ano).toBe(2026);
    expect(a.precoConsumidorIndice).toBeCloseTo(1, 10);
    expect(a.cargaTotal).toBeCloseTo(sim.cargaAtual, 6);
    expect(a.ibsCbsLiquido).toBe(0);
  });

  it("mantém o lucro em todos os anos quando o preço é reajustado", () => {
    for (const a of sim.anos) {
      const custos =
        PERFIL_EXEMPLO.comprasAnuais +
        PERFIL_EXEMPLO.despesasCreditaveis +
        PERFIL_EXEMPLO.despesasNaoCreditaveis;
      const lucro = a.receitaNecessaria - a.tributosAntigos + a.ibsCbsCredito - custos;
      expect(lucro).toBeCloseTo(sim.lucroAtual, 4);
    }
  });

  it("cobre 2026 a 2033 com ICMS extinto no fim", () => {
    expect(sim.anos.map((a) => a.ano)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]);
    expect(sim.anos.at(-1)!.tributosAntigos).toBeCloseTo(0, 6);
  });

  it("lucro presumido de comércio B2B ganha crédito amplo e paga menos em 2033", () => {
    expect(sim.resumo.variacaoCarga2033).toBeLessThan(0);
  });

  it("serviço com pouca compra no presumido sofre aumento de carga", () => {
    const s = simular({
      ...servicoSimples,
      regime: "presumido",
      aliquotaIss: 0.05,
    });
    expect(s.resumo.variacaoCarga2033).toBeGreaterThan(0.5);
    expect(s.resumo.reajusteNecessario2033).toBeGreaterThan(0.1);
  });

  it("redução de 60% diminui o reajuste necessário", () => {
    const base = simular({ ...servicoSimples, regime: "presumido" });
    const reduzido = simular({ ...servicoSimples, regime: "presumido", reducaoVendas: "reducao60" });
    expect(reduzido.resumo.reajusteNecessario2033).toBeLessThan(base.resumo.reajusteNecessario2033);
  });
});

describe("Simples Nacional", () => {
  it("Simples puro mantém preço, mas o cliente PJ perde crédito a partir de 2027", () => {
    const sim = simular(servicoSimples);
    expect(sim.anos.every((a) => a.precoConsumidorIndice === 1)).toBe(true);
    const a27 = sim.anos.find((a) => a.ano === 2027)!;
    expect(a27.custoClientePJIndice).toBeGreaterThan(1.05);
  });

  it("recomenda híbrido para quem vende quase tudo para empresas", () => {
    const c = compararSimples({ ...servicoSimples, percentualB2B: 0.95 });
    expect(c.recomendacao2033).toBe("hibrido");
  });

  it("recomenda Simples puro para quem vende para consumidor final", () => {
    const c = compararSimples({ ...servicoSimples, percentualB2B: 0.05 });
    expect(c.recomendacao2033).toBe("puro");
    expect(c.pontoDeVirada2033).not.toBeNull();
  });
});

describe("split payment", () => {
  it("quem recebe à vista perde folga de caixa", () => {
    const r = impactoSplitPayment({
      ibsCbsDebitoAnual: 1_200_000,
      ibsCbsCreditoAnual: 600_000,
      prazoMedioRecebimentoDias: 0,
    });
    expect(r.capitalGiroInteligente).toBeCloseTo((50_000 * 40) / 30, 6);
    expect(r.capitalGiroSimplificado).toBeGreaterThan(r.capitalGiroInteligente);
  });

  it("quem vende a prazo longo pode ganhar caixa", () => {
    const r = impactoSplitPayment({
      ibsCbsDebitoAnual: 1_200_000,
      ibsCbsCreditoAnual: 600_000,
      prazoMedioRecebimentoDias: 60,
    });
    expect(r.capitalGiroInteligente).toBeLessThan(0);
  });
});

describe("apoio", () => {
  it("valida o perfil de exemplo", () => {
    expect(perfilSchema.parse(PERFIL_EXEMPLO)).toEqual(PERFIL_EXEMPLO);
  });

  it("encontra categoria por palavra-chave sem acento", () => {
    expect(buscarCategoria("feijao")[0]?.reducao).toBe("zero");
    expect(buscarCategoria("advogados")[0]?.reducao).toBe("reducao30");
  });
});
