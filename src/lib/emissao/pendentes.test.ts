import { describe, expect, it } from "vitest";
import { criterioPendentes, IDADE_MINIMA_PENDENTE_MS } from "./regras";

const agora = new Date("2026-10-30T12:00:00Z");

describe("criterioPendentes", () => {
  it("só notas processando criadas há mais de 1 minuto", () => {
    const c = criterioPendentes(20, agora);
    expect(c.where.status).toBe("processando");
    expect(c.where.createdAt.lt.getTime()).toBe(agora.getTime() - IDADE_MINIMA_PENDENTE_MS);
    expect(IDADE_MINIMA_PENDENTE_MS).toBe(60_000);
  });

  it("mais antigas primeiro, e a que acabou de ser consultada vai para o fim", () => {
    expect(criterioPendentes(20, agora).orderBy).toEqual([{ updatedAt: "asc" }, { createdAt: "asc" }]);
  });

  it("respeita o limite, entre 1 e 100", () => {
    expect(criterioPendentes(20, agora).take).toBe(20);
    expect(criterioPendentes(0, agora).take).toBe(1);
    expect(criterioPendentes(-5, agora).take).toBe(1);
    expect(criterioPendentes(1000, agora).take).toBe(100);
    expect(criterioPendentes(Number.NaN, agora).take).toBe(1);
    expect(criterioPendentes(7.9, agora).take).toBe(7);
  });
});
