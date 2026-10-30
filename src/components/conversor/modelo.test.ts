import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { converterNota, lerNota } from "../../lib/nfe";
import { XML_EXEMPLO, CHAVE_EXEMPLO } from "../../app/api/converter/_lib/exemplo";
import {
  ajusteSchema,
  aplicarEscolhas,
  classificacoesDe,
  envioSchema,
  lerResultadoSalvo,
  mesclarEscolhas,
  montarCsv,
  nomeArquivo,
  validarArquivo,
  type Escolha,
} from "./modelo";

const fixture = readFileSync(join(__dirname, "..", "..", "lib", "nfe", "__fixtures__", "nfe-antiga.xml"), "utf8");
const nota = lerNota(fixture);

describe("nota de exemplo", () => {
  it("é igual à fixture e tem a chave usada para não contar no limite", () => {
    expect(XML_EXEMPLO).toBe(fixture);
    expect(lerNota(XML_EXEMPLO).chave).toBe(CHAVE_EXEMPLO);
  });
});

describe("validarArquivo", () => {
  it("aceita .xml até 2 MB", () => {
    expect(validarArquivo({ name: "nota.XML", size: 1000, type: "text/xml" })).toBeNull();
    expect(validarArquivo({ name: "nota.xml", size: 1000, type: "" })).toBeNull();
  });
  it("recusa outra extensão, tipo, arquivo vazio ou grande demais", () => {
    expect(validarArquivo({ name: "nota.pdf", size: 1000 })).toMatch(/\.xml/);
    expect(validarArquivo({ name: "nota.xml", size: 1000, type: "application/pdf" })).toMatch(/não é um XML/);
    expect(validarArquivo({ name: "nota.xml", size: 0 })).toMatch(/vazio/);
    expect(validarArquivo({ name: "nota.xml", size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
  });
});

describe("validação de entrada", () => {
  it("aceita só 2026, 2027 e 2033 e cenários conhecidos", () => {
    expect(envioSchema.safeParse({ ano: "2027" }).data?.ano).toBe(2027);
    expect(envioSchema.safeParse({ ano: "2030" }).success).toBe(false);
    expect(envioSchema.safeParse({ ano: "abc" }).success).toBe(false);
    expect(envioSchema.safeParse({ ano: "2033", cenarioId: "inventado" }).success).toBe(false);
  });

  it("PATCH exige algo para mudar e categorias válidas", () => {
    expect(ajusteSchema.safeParse({}).success).toBe(false);
    expect(ajusteSchema.safeParse({ classificacoes: { 1: "cesta-basica" } }).success).toBe(true);
    expect(ajusteSchema.safeParse({ classificacoes: { 1: "nao-existe" } }).success).toBe(false);
    expect(ajusteSchema.safeParse({ classificacoes: { abc: "padrao" } }).success).toBe(false);
    expect(ajusteSchema.safeParse({ empresaId: null }).success).toBe(true);
    expect(ajusteSchema.safeParse({ ano: 2033 }).success).toBe(true);
  });
});

describe("escolhas", () => {
  it("itens escolhidos pela IA voltam a ser 'ia' e só dispensam conferência com confiança alta", () => {
    const escolhas: Record<string, Escolha> = {
      "1": { categoriaId: "cesta-basica", origem: "ia", confianca: "alta" },
      "3": { categoriaId: "padrao", origem: "ia", confianca: "baixa", conferir: "Confirme o NCM." },
    };
    const conv = converterNota(nota, { ano: 2027, classificacoes: classificacoesDe(escolhas) });
    const r = aplicarEscolhas(conv, escolhas);
    expect(r.itens[0].origem).toBe("ia");
    expect(r.itens[0].conferir).toBe(false);
    expect(r.itens[2].origem).toBe("ia");
    expect(r.itens[2].conferir).toBe(true);
    expect(r.itens[2].dica).toBe("Confirme o NCM.");
    expect(r.itens[1].origem).toBe("palavras-chave");
    expect(r.avisos.filter((a) => /conferência/.test(a))).toEqual([
      expect.stringContaining("2 itens precisam"),
    ]);
    expect("xml" in r).toBe(false);
  });

  it("escolha do usuário sobrepõe a da IA e ignora itens que não existem", () => {
    const atuais: Record<string, Escolha> = { "1": { categoriaId: "padrao", origem: "ia", confianca: "media" } };
    const m = mesclarEscolhas(atuais, { "1": "cesta-basica", "99": "padrao" }, [1, 2, 3]);
    expect(m).toEqual({ "1": { categoriaId: "cesta-basica", origem: "usuario" } });
    const r = aplicarEscolhas(converterNota(nota, { ano: 2027, classificacoes: classificacoesDe(m) }), m);
    expect(r.itens[0].origem).toBe("usuario");
    expect(r.itens[0].conferir).toBe(false);
  });

  it("lê de volta o JSON salvo e recusa JSON corrompido", () => {
    const r = aplicarEscolhas(converterNota(nota, { ano: 2033 }), {});
    expect(lerResultadoSalvo(JSON.stringify(r))?.totais.totalNoAno).toBe(r.totais.totalNoAno);
    expect(lerResultadoSalvo("{")).toBeNull();
    expect(lerResultadoSalvo('{"itens":3}')).toBeNull();
  });
});

describe("CSV", () => {
  it("uma linha por item, ';', decimais com vírgula e proteção contra fórmula", () => {
    const r = aplicarEscolhas(converterNota(nota, { ano: 2027 }), {});
    r.itens[0] = { ...r.itens[0], descricao: "=HYPERLINK(\"x\")" };
    const linhas = montarCsv(r).replace(/^﻿/, "").split("\r\n");
    expect(linhas).toHaveLength(1 + r.itens.length);
    expect(linhas[0].split(";")).toContain("cclasstrib");
    expect(linhas[1]).toContain(`"'=HYPERLINK(""x"")"`);
    const camiseta = linhas[3].split(";");
    expect(camiseta[0]).toBe("1234");
    expect(camiseta[3]).toBe("61091000");
    expect(camiseta[5]).toBe("500,00");
    expect(camiseta[8]).toBe("000001");
  });

  it("nome do arquivo usa só os dígitos da chave", () => {
    expect(nomeArquivo('35"/../x', 2027, "xml")).toBe("35-ibscbs-2027.xml");
    expect(nomeArquivo(CHAVE_EXEMPLO, 2033, "csv")).toBe(`${CHAVE_EXEMPLO}-ibscbs-2033.csv`);
  });
});
