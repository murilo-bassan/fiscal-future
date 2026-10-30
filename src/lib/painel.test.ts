import { describe, expect, it } from "vitest";
import { agruparPorMes, rankingDestinatarios, variacao } from "./painel";

describe("painel mensal", () => {
  it("agrupa meses em JavaScript e soma somente notas autorizadas", () => {
    const dados = agruparPorMes([
      { createdAt: new Date(2026, 9, 3), status: "autorizada", valorTotal: 100, ibsCbsTotal: 12, destinatario: "A" },
      { createdAt: new Date(2026, 9, 4), status: "rejeitada", valorTotal: 500, ibsCbsTotal: 60, destinatario: "B" },
      { createdAt: new Date(2026, 8, 4), status: "autorizada", valorTotal: 50, ibsCbsTotal: 6, destinatario: "A" },
    ], 2, new Date(2026, 9, 30));
    expect(dados).toEqual([
      { mes: "2026-09", notas: 1, faturamento: 50, ibsCbs: 6 },
      { mes: "2026-10", notas: 1, faturamento: 100, ibsCbs: 12 },
    ]);
  });

  it("calcula variação e sinaliza uma base anterior zerada", () => {
    expect(variacao(150, 100)).toBe(50);
    expect(variacao(0, 0)).toBe(0);
    expect(variacao(20, 0)).toBeNull();
  });

  it("ordena os destinatários por faturamento autorizado", () => {
    const base = (destinatario: string, valorTotal: number, status = "autorizada") => ({ destinatario, valorTotal, status, ibsCbsTotal: 0, createdAt: new Date() });
    expect(rankingDestinatarios([base("A", 100), base(" B ", 150), base("A", 30), base("C", 900, "rejeitada")])).toEqual([
      { destinatario: "B", notas: 1, faturamento: 150 },
      { destinatario: "A", notas: 2, faturamento: 130 },
    ]);
  });
});
