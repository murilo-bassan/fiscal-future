import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { ErroLeituraNota, aliquotasNota, calcularIbsCbsItem, converterNota, lerNota } from "./index";
import { categoriaPorId } from "../tax/categorias";

const xml = readFileSync(join(__dirname, "__fixtures__", "nfe-antiga.xml"), "utf8");

describe("lerNota", () => {
  const n = lerNota(xml);

  it("lê cabeçalho, participantes e protocolo", () => {
    expect(n.chave).toBe("35251012345678000195550010000012341000012345");
    expect(n.modelo).toBe("55");
    expect(n.numero).toBe("1234");
    expect(n.autorizada).toBe(true);
    expect(n.emitente.documento).toBe("12345678000195");
    expect(n.destinatario?.nome).toBe("Mercado Cliente Ltda & Cia");
    expect(n.crt).toBe("3");
  });

  it("mantém zeros à esquerda e lê os tributos por item", () => {
    expect(n.itens).toHaveLength(3);
    const [arroz, sabonete] = n.itens;
    expect(arroz.ncm).toBe("10063021");
    expect(arroz.icms).toBe(17.5);
    expect(arroz.icmsCst).toBe("20");
    expect(sabonete.desconto).toBe(10);
    expect(sabonete.pis).toBe(1.56);
  });

  it("recusa arquivos que não são NF-e e XML com DOCTYPE", () => {
    expect(() => lerNota("<CompNfse/>")).toThrow(ErroLeituraNota);
    expect(() => lerNota('<!DOCTYPE x [<!ENTITY a "b">]><NFe/>')).toThrow(ErroLeituraNota);
  });
});

describe("calcularIbsCbsItem", () => {
  it("2026: CBS 0,9% e IBS estadual 0,1%, compensáveis", () => {
    const t = calcularIbsCbsItem(1000, categoriaPorId("padrao"), aliquotasNota(2026));
    expect(t.cbs.valor).toBe(9);
    expect(t.ibsUf.valor).toBe(1);
    expect(t.ibsMun.valor).toBe(0);
    expect(t.compensavel).toBe(true);
  });

  it("aplica redução de 60% e alíquota zero", () => {
    const a = aliquotasNota(2033);
    const cheio = calcularIbsCbsItem(1000, categoriaPorId("padrao"), a).total;
    const reduzido = calcularIbsCbsItem(1000, categoriaPorId("higiene"), a).total;
    expect(reduzido).toBeCloseTo(cheio * 0.4, 1);
    expect(calcularIbsCbsItem(1000, categoriaPorId("cesta-basica"), a).total).toBe(0);
  });

  it("isenção e imunidade não levam o grupo gIBSCBS", () => {
    const t = calcularIbsCbsItem(1000, categoriaPorId("livros"), aliquotasNota(2027));
    expect(t.temGrupo).toBe(false);
    expect(t.total).toBe(0);
  });
});

describe("converterNota", () => {
  const nota = lerNota(xml);

  it("classifica por palavra-chave e pede conferência", () => {
    const c = converterNota(nota, { ano: 2027 });
    const [arroz, sabonete, camiseta] = c.itens;
    expect(arroz.categoria.cClassTrib).toBe("200003");
    expect(sabonete.categoria.id).toBe("higiene");
    expect(camiseta.categoria.cClassTrib).toBe("000001");
    expect(c.itens.every((i) => i.conferir)).toBe(true);
  });

  it("respeita a escolha do usuário", () => {
    const c = converterNota(nota, { ano: 2027, classificacoes: { 3: "profissoes-regulamentadas" } });
    expect(c.itens[2].categoria.cClassTrib).toBe("200052");
    expect(c.itens[2].conferir).toBe(false);
  });

  it("em 2027 a base exclui o ICMS e PIS/Cofins somem", () => {
    const c = converterNota(nota, { ano: 2027 });
    const camiseta = c.itens[2];
    expect(camiseta.ibsCbs.base).toBe(410); // 500 − 90 de ICMS
    expect(camiseta.tributosAntigosNoAno).toBe(90);
  });

  it("em 2026 o total a pagar não muda", () => {
    const c = converterNota(nota, { ano: 2026 });
    expect(c.totais.totalNoAno).toBe(c.totais.tributosOriginais);
    expect(c.totais.ibsCbs).toBeGreaterThan(0);
  });

  it("gera XML sem assinatura com os grupos IBSCBS e IBSCBSTot", () => {
    const c = converterNota(nota, { ano: 2027 });
    expect(c.xml).not.toContain("Signature");
    expect(c.xml).not.toContain("protNFe");
    const doc = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(c.xml);
    const det = doc.NFe.infNFe.det;
    expect(det[2].imposto.IBSCBS.CST).toBe("000");
    expect(det[2].imposto.IBSCBS.gIBSCBS.vBC).toBe("410.00");
    expect(det[1].imposto.IBSCBS.gIBSCBS.gCBS.gRed.pRedAliq).toBe("60.0000");
    expect(doc.NFe.infNFe.total.IBSCBSTot.gCBS.vCBS).toBe(c.totais.cbs.toFixed(2));
    expect(c.xml).toContain("Mercado Cliente Ltda &amp; Cia");
  });
});
