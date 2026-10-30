import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classificar, classificarPorPalavrasChave, PROMPT_SISTEMA } from "./classificador";
import { REGIMES_ESPECIFICOS } from "./tax/categorias";

describe("classificarPorPalavrasChave", () => {
  it("acha a cesta básica pelo nome do produto", () => {
    const r = classificarPorPalavrasChave("Arroz branco tipo 1, 5 kg");
    expect(r.categoriaId).toBe("cesta-basica");
    expect(r.reducao).toBe("zero");
    expect(r.confianca).toBe("media");
    expect(r.origem).toBe("palavras-chave");
    expect(r.conferir).toMatch(/NCM/);
  });

  it("reconhece plural/singular e acento (advogado ~ advogados)", () => {
    const r = classificarPorPalavrasChave("Honorários de advogado");
    expect(r.categoriaId).toBe("profissoes-regulamentadas");
    expect(r.reducao).toBe("reducao30");
  });

  it("sem correspondência: alíquota padrão e confiança baixa", () => {
    const r = classificarPorPalavrasChave("Parafuso sextavado M8");
    expect(r.categoriaId).toBe("padrao");
    expect(r.reducao).toBe("padrao");
    expect(r.confianca).toBe("baixa");
  });

  it("ambíguo entre reduções: fica com a menor e confiança baixa", () => {
    // "medicamentos" aparece em categorias de alíquota zero e de -60%
    const r = classificarPorPalavrasChave("Medicamento");
    expect(r.reducao).toBe("reducao60");
    expect(r.confianca).toBe("baixa");
  });

  it("sinaliza regime específico com nome exato da lista", () => {
    const r = classificarPorPalavrasChave("Gasolina comum");
    expect(r.regimeEspecifico).toBe("Combustíveis");
    expect(REGIMES_ESPECIFICOS).toContain(r.regimeEspecifico);
    expect(r.reducao).toBe("padrao");
    expect(r.confianca).toBe("baixa");
  });

  it("palavras genéricas não puxam categorias por engano", () => {
    const r = classificarPorPalavrasChave("Serviço de marketing digital");
    expect(r.reducao).toBe("padrao");
  });
});

describe("classificar sem ANTHROPIC_API_KEY", () => {
  let chave: string | undefined;
  beforeEach(() => {
    chave = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (chave !== undefined) process.env.ANTHROPIC_API_KEY = chave;
  });

  it("usa palavras-chave e mantém a ordem", async () => {
    const r = await classificar(["feijão carioca 1kg", "consultoria em vendas"]);
    expect(r.modo).toBe("palavras-chave");
    expect(r.itens.map((i) => i.descricao)).toEqual(["feijão carioca 1kg", "consultoria em vendas"]);
    expect(r.itens[0].reducao).toBe("zero");
    expect(r.itens.every((i) => i.origem === "palavras-chave")).toBe(true);
  });
});

describe("PROMPT_SISTEMA", () => {
  it("traz todas as categorias e regimes e é estável (cache)", () => {
    expect(PROMPT_SISTEMA).toContain("cesta-basica");
    for (const r of REGIMES_ESPECIFICOS) expect(PROMPT_SISTEMA).toContain(r);
    expect(PROMPT_SISTEMA).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // sem timestamps
  });
});
