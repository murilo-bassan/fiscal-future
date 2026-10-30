import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import {
  converterNota,
  entradaDeNota,
  infoDaChave,
  notaDeEntrada,
  notaManualSchema,
  rascunhoDeConversao,
  type NotaManualEntrada,
} from "./index";

const CHAVE = "35251012345678000195550010000012341000012340";

const venda: NotaManualEntrada = {
  tipo: "nfe",
  chave: "3525 1012 3456 7800 0195 5500 1000 0012 3410 0001 2340",
  regimeEmitente: "normal",
  emitente: { nome: "Distribuidora Exemplo Ltda" },
  destinatario: { documento: "98.765.432/0001-98", nome: "Mercado Cliente" },
  itens: [
    { descricao: "Camiseta de algodão", ncm: "6109.10.00", cfop: "5102", quantidade: 20, valorUnitario: 25, icms: 90, pis: 3.25, cofins: 15 },
  ],
};

const servico: NotaManualEntrada = {
  tipo: "nfse",
  numero: "882",
  emissao: "2025-09-10",
  regimeEmitente: "normal",
  emitente: { documento: "12345678000195", nome: "Consultoria Exemplo Ltda", uf: "SP" },
  destinatario: { documento: "98765432000198", nome: "Cliente SA" },
  itens: [{ descricao: "Honorários advocatícios", codigoServico: "17.14", valorUnitario: 10000, iss: 500, pis: 65, cofins: 300 }],
};

describe("infoDaChave", () => {
  it("lê UF, mês, CNPJ, modelo, série e número", () => {
    expect(infoDaChave(CHAVE)).toEqual({
      valida: true,
      uf: "SP",
      anoMes: "2025-10",
      cnpjEmitente: "12345678000195",
      modelo: "55",
      serie: "1",
      numero: "1234",
    });
    expect(infoDaChave("123")).toBeNull();
  });
});

describe("notaManualSchema", () => {
  it("limpa máscaras e recusa chave com dígito errado", () => {
    const m = notaManualSchema.parse(venda);
    expect(m.chave).toBe(CHAVE);
    expect(m.itens[0].ncm).toBe("61091000");
    expect(m.destinatario?.documento).toBe("98765432000198");
    const errada = notaManualSchema.safeParse({ ...venda, chave: CHAVE.slice(0, 43) + "9" });
    expect(errada.success).toBe(false);
  });

  it("exige pelo menos um item e o nome do emitente", () => {
    expect(notaManualSchema.safeParse({ ...venda, itens: [] }).success).toBe(false);
    expect(notaManualSchema.safeParse({ ...venda, emitente: { nome: "" } }).success).toBe(false);
  });
});

describe("conversão de nota digitada", () => {
  it("NF-e: completa o cabeçalho pela chave e calcula como o XML", () => {
    const nota = notaDeEntrada(notaManualSchema.parse(venda), "manual");
    expect(nota.numero).toBe("1234");
    expect(nota.emitente.documento).toBe("12345678000195");
    expect(nota.emitente.uf).toBe("SP");
    const c = converterNota(nota, { ano: 2027 });
    expect(c.itens[0].ibsCbs.base).toBe(410); // 500 − 90 de ICMS, igual à nota em XML
    const doc = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(c.xml);
    expect(doc.NFe.infNFe.det.imposto.IBSCBS.cClassTrib).toBe("000001");
    expect(doc.NFe.infNFe.total.IBSCBSTot.gCBS.vCBS).toBe(c.totais.cbs.toFixed(2));
    expect(c.xml).toContain("Montada a partir de dados digitados");
  });

  it("NFS-e: ISS sai da base, profissão regulamentada tem 30% de redução", () => {
    const nota = notaDeEntrada(notaManualSchema.parse(servico), "documento");
    const c = converterNota(nota, { ano: 2026 });
    const item = c.itens[0];
    expect(item.categoria.cClassTrib).toBe("200052");
    expect(item.ibsCbs.base).toBe(10000 - 500 - 65 - 300);
    expect(c.totais.totalNoAno).toBe(865); // 2026: compensável, não muda o total
    const doc = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(c.xml);
    expect(doc.NFSeReferencia.infNFSe.servicos.servico.IBSCBS.CST).toBe("200");
  });

  it("NFS-e vira rascunho de NFS-e para emitir", () => {
    const nota = notaDeEntrada(notaManualSchema.parse(servico), "manual");
    const r = rascunhoDeConversao(nota, converterNota(nota, { ano: 2026 }));
    expect(r.tipo).toBe("nfse");
    expect(r.itens[0].codigoServico).toBe("17.14");
  });

  it("ida e volta: entradaDeNota reproduz a mesma nota", () => {
    const nota = notaDeEntrada(notaManualSchema.parse(venda), "planilha");
    const de_novo = notaDeEntrada(notaManualSchema.parse(entradaDeNota(nota)), "planilha");
    expect(de_novo).toEqual(nota);
  });
});
