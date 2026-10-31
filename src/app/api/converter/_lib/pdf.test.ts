import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { aplicarEscolhas, conferirConversao } from "@/components/conversor/modelo";
import { converterNota, lerNota } from "@/lib/nfe";
import { gerarPdfConversao, textoSeguro } from "./pdf";

const xml = readFileSync(join(__dirname, "../../../../lib/nfe/__fixtures__/nfe-antiga.xml"), "utf8");
const resultado = () => aplicarEscolhas(converterNota(lerNota(xml), { ano: 2027 }), {});

describe("textoSeguro", () => {
  it("mantém acentos do português e troca o que a fonte padrão não desenha", () => {
    expect(textoSeguro("Ação · São Paulo – nº 1")).toBe("Ação · São Paulo – nº 1");
    expect(textoSeguro("Ćwierć ≈ 10\n✓")).toBe("Cwierc ? 10 ?");
    expect(textoSeguro("Łódź")).toBe("?ódz");
  });
});

describe("conferirConversao", () => {
  it("aponta itens a conferir e aceita uma nota sem problemas", () => {
    const r = resultado();
    const c = conferirConversao(r);
    expect(c.pendencias.length).toBe(r.itens.filter((i) => i.conferir).length);

    const semConferir = { ...r, itens: r.itens.map((i) => ({ ...i, conferir: false })) };
    expect(conferirConversao(semConferir)).toEqual({ ok: true, pendencias: [] });
  });

  it("acusa código fora do formato e total que não bate", () => {
    const r = resultado();
    const [primeiro, ...resto] = r.itens.map((i) => ({ ...i, conferir: false }));
    const ruim = {
      ...r,
      itens: [{ ...primeiro, ncm: "123", ibsCbs: { ...primeiro.ibsCbs, cClassTrib: "1" } }, ...resto],
      totais: { ...r.totais, ibsCbs: r.totais.ibsCbs + 10 },
    };
    const c = conferirConversao(ruim);
    expect(c.ok).toBe(false);
    expect(c.pendencias.join(" ")).toMatch(/cClassTrib/);
    expect(c.pendencias.join(" ")).toMatch(/NCM/);
    expect(c.pendencias.join(" ")).toMatch(/não bate com o total/);
  });
});

describe("gerarPdfConversao", () => {
  it("gera um PDF válido com metadados da nota", async () => {
    const bytes = await gerarPdfConversao(resultado(), new Date("2026-10-31T12:00:00Z"));
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    const lido = await PDFDocument.load(bytes);
    expect(lido.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(lido.getTitle()).toMatch(/IBS\/CBS \(2027\)/);
  });

  it("quebra em várias páginas quando a nota tem muitos itens", async () => {
    const r = resultado();
    const muitos = { ...r, itens: Array.from({ length: 90 }, (_, k) => ({ ...r.itens[0], nItem: k + 1 })) };
    const lido = await PDFDocument.load(await gerarPdfConversao(muitos));
    expect(lido.getPageCount()).toBeGreaterThan(2);
  });
});
