import { describe, expect, it } from "vitest";
import { calcularRascunho } from "./calculo";
import type { RascunhoNota } from "./tipos";

const servico: RascunhoNota = {
  tipo: "nfse",
  naturezaOperacao: "Prestação de serviço",
  destinatario: { documento: "98765432000110", nome: "Cliente", consumidorFinal: false },
  itens: [{ codigo: "1", descricao: "Consultoria", unidade: "UN", quantidade: 1, valorUnitario: 1000, desconto: 0, categoriaId: "padrao" }],
};

describe("calcularRascunho", () => {
  it("NFS-e do presumido em 2026: ISS, PIS/Cofins e IBS/CBS informativo", () => {
    const c = calcularRascunho({ crt: "3", regime: "presumido", aliquotaIssPadrao: 0.05 }, servico, { ano: 2026 });
    expect(c.totais.iss).toBe(50);
    expect(c.totais.pis).toBe(6.5);
    expect(c.totais.cofins).toBe(30);
    expect(c.totais.base).toBe(913.5);
    expect(c.totais.cbs).toBeCloseTo(8.22, 2);
    expect(c.totais.notaComIbsCbs).toBe(1000);
  });

  it("2027: sem PIS/Cofins e IBS/CBS por fora", () => {
    const c = calcularRascunho({ crt: "3", regime: "presumido", aliquotaIssPadrao: 0.05 }, servico, { ano: 2027 });
    expect(c.totais.pis).toBe(0);
    expect(c.totais.base).toBe(950);
    expect(c.totais.notaComIbsCbs).toBeCloseTo(1000 + c.totais.ibsCbs, 2);
  });

  it("profissão regulamentada tem 30% de redução", () => {
    const r = { ...servico, itens: [{ ...servico.itens[0], categoriaId: "profissoes-regulamentadas" }] };
    const c = calcularRascunho({ crt: "3", regime: "presumido", aliquotaIssPadrao: 0.05 }, r, { ano: 2027 });
    expect(c.itens[0].ibsCbs.cClassTrib).toBe("200052");
    expect(c.itens[0].ibsCbs.cbs.aliquotaEfetiva).toBeCloseTo(0.087 * 0.7, 6);
  });
});
