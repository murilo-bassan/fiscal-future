import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ErroExtracao,
  extrairNotaDeDocumento,
  montarResultado,
  ratear,
  tipoPelosBytes,
  validarDocumento,
  type ClienteExtracao,
  type SaidaExtracao,
} from "./extracao";
import { notaDeEntrada, notaManualSchema } from "./nfe/entrada";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Pages /Count 1 >> endobj\n2 0 obj << /Type /Page >> endobj\n%%EOF");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

const itemVazio = {
  codigo: "",
  ncm: "",
  cfop: "",
  codigoServico: "",
  unidade: "UN",
  quantidade: 1,
  valorUnitario: null,
  valorTotal: null,
  desconto: null,
  icms: null,
  pis: null,
  cofins: null,
  ipi: null,
  iss: null,
};

const saidaBase = (s: Partial<SaidaExtracao> = {}): SaidaExtracao => ({
  ehNotaFiscal: true,
  tipo: "nfe",
  regimeEmitente: "normal",
  chave: "3525 1012 3456 7800 0195 5500 1000 0012 3410 0001 2340",
  numero: "1234",
  serie: "1",
  emissao: "15/10/2025",
  naturezaOperacao: "Venda de mercadoria",
  emitente: { documento: "12.345.678/0001-95", nome: "Distribuidora Exemplo Ltda", uf: "sp" },
  destinatario: { documento: "98.765.432/0001-98", nome: "Mercado Cliente", uf: "SP" },
  itens: [
    { ...itemVazio, descricao: "Arroz tipo 1 5kg", ncm: "1006.30.21", cfop: "5102", quantidade: 10, valorUnitario: 25, valorTotal: 250, icms: 17.5 },
    { ...itemVazio, descricao: "Camiseta de algodão", ncm: "6109.10.00", cfop: "5102", quantidade: 20, valorUnitario: 25, valorTotal: 500, icms: 90 },
  ],
  totais: { icms: 107.5, pis: null, cofins: null, ipi: null, iss: null },
  camposIlegiveis: [],
  confianca: "alta",
  observacoes: [],
  ...s,
});

function clienteMock(resposta: unknown): ClienteExtracao & { parse: ReturnType<typeof vi.fn> } {
  const parse = vi.fn().mockResolvedValue(resposta);
  return { parse, beta: { messages: { parse: parse as unknown as ClienteExtracao["beta"]["messages"]["parse"] } } };
}

describe("validarDocumento", () => {
  it("reconhece PDF, JPEG, PNG e WEBP pela assinatura", () => {
    expect(tipoPelosBytes(PDF)).toBe("application/pdf");
    expect(tipoPelosBytes(JPEG)).toBe("image/jpeg");
    expect(tipoPelosBytes(PNG)).toBe("image/png");
    expect(tipoPelosBytes(WEBP)).toBe("image/webp");
    expect(tipoPelosBytes(Buffer.from("<?xml version"))).toBeNull();
  });

  it("recusa mime que não confere com os bytes", () => {
    expect(() => validarDocumento({ bytes: Buffer.from("MZ executável"), mimeType: "application/pdf" })).toThrow(ErroExtracao);
    expect(() => validarDocumento({ bytes: PNG, mimeType: "image/jpeg" })).toThrow(/não confere/);
    expect(() => validarDocumento({ bytes: PDF, mimeType: "text/html" })).toThrow(/PDF ou uma foto/);
    expect(validarDocumento({ bytes: JPEG, mimeType: "image/jpg" })).toBe("image/jpeg");
  });

  it("aplica os limites de tamanho e de páginas", () => {
    const grande = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    expect(() => validarDocumento({ bytes: grande, mimeType: "image/jpeg" })).toThrow(/5 MB/);
    const paginas = Buffer.from("%PDF-1.4\n" + "<< /Type /Page >>\n".repeat(21));
    expect(() => validarDocumento({ bytes: paginas, mimeType: "application/pdf" })).toThrow(/21 páginas/);
  });
});

describe("ratear", () => {
  it("divide pelo peso e põe a sobra dos centavos no maior item", () => {
    expect(ratear(100, [1, 1, 1])).toEqual([33.34, 33.33, 33.33]);
    expect(ratear(30, [100, 200])).toEqual([10, 20]);
    expect(ratear(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("montarResultado", () => {
  it("limpa máscaras, converte a data e valida com o notaManualSchema", () => {
    const r = montarResultado(saidaBase());
    expect(r.confianca).toBe("alta");
    expect(r.avisos).toEqual([]);
    const m = notaManualSchema.parse(r.nota);
    expect(m.emissao).toBe("2025-10-15");
    expect(m.emitente.documento).toBe("12345678000195");
    expect(m.emitente.uf).toBe("SP");
    expect(m.itens[0].ncm).toBe("10063021");
    expect(m.itens.map((i) => i.icms)).toEqual([17.5, 90]);
  });

  it("rateia tributo que só aparece no total, proporcional ao valor, e avisa", () => {
    const r = montarResultado(saidaBase({ totais: { icms: 107.5, pis: 7.5, cofins: null, ipi: null, iss: null } }));
    const m = notaManualSchema.parse(r.nota);
    expect(m.itens.map((i) => i.pis)).toEqual([2.5, 5]);
    expect(r.avisos.join(" ")).toMatch(/PIS total/);
    // A soma bate com o total do documento
    const nota = notaDeEntrada(m, "documento");
    expect(nota.totais.pis).toBe(7.5);
  });

  it("completa só os itens sem valor quando parte do tributo veio por item", () => {
    const s = saidaBase();
    s.itens[1].icms = null;
    const r = montarResultado(s);
    expect(r.nota.itens.map((i) => i.icms)).toEqual([17.5, 90]);
    expect(r.avisos[0]).toMatch(/Parte do ICMS/);
  });

  it("deixa em branco o que veio fora do formato, com aviso, sem derrubar a leitura", () => {
    const s = saidaBase({ chave: "3525101234567800019555001000001234100001234" + "9" });
    s.itens[0].ncm = "1006";
    const r = montarResultado(s);
    expect(r.nota.chave).toBe("");
    expect(r.nota.itens[0].ncm).toBe("");
    expect(r.confianca).toBe("media");
    expect(r.avisos.join(" ")).toMatch(/chave/);
  });

  it("calcula o valor unitário pelo total e acusa conta que não fecha", () => {
    const s = saidaBase();
    s.itens[0] = { ...s.itens[0], valorUnitario: null, quantidade: 4, valorTotal: 100 };
    s.itens[1] = { ...s.itens[1], valorTotal: 400 };
    const r = montarResultado(s);
    expect(r.nota.itens[0].valorUnitario).toBe(25);
    expect(r.avisos.join(" ")).toMatch(/Item 2: quantidade × valor unitário não bate/);
  });

  it("NFS-e: ISS, PIS e Cofins retidos entram no item; regime Simples", () => {
    const r = montarResultado(
      saidaBase({
        tipo: "nfse",
        regimeEmitente: "simples",
        chave: "",
        itens: [{ ...itemVazio, descricao: "Honorários advocatícios", codigoServico: "17.14", valorTotal: 10000, iss: 500, pis: 65, cofins: 300, ncm: "123" }],
        totais: { icms: null, pis: 65, cofins: 300, ipi: null, iss: 500 },
      }),
    );
    const m = notaManualSchema.parse(r.nota);
    expect(m.tipo).toBe("nfse");
    expect(m.regimeEmitente).toBe("simples");
    expect(m.itens[0]).toMatchObject({ valorUnitario: 10000, iss: 500, pis: 65, cofins: 300, ncm: "", codigoServico: "17.14" });
  });

  it("recusa o que não é nota e nota sem itens", () => {
    expect(() => montarResultado(saidaBase({ ehNotaFiscal: false }))).toThrow(/não parece/);
    expect(() => montarResultado(saidaBase({ itens: [] }))).toThrow(/itens/);
  });

  it("campos ilegíveis viram aviso e baixam a confiança", () => {
    const r = montarResultado(saidaBase({ camposIlegiveis: ["NCM do item 2", "CNPJ do destinatário", "série", "número"] }));
    expect(r.confianca).toBe("baixa");
    expect(r.avisos.at(-1)).toMatch(/Não deu para ler: NCM do item 2/);
  });
});

describe("extrairNotaDeDocumento", () => {
  const chaveAntiga = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (chaveAntiga === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = chaveAntiga;
  });

  it("envia PDF como document e devolve a nota validada", async () => {
    const c = clienteMock({ stop_reason: "end_turn", parsed_output: saidaBase() });
    const r = await extrairNotaDeDocumento({ bytes: PDF, mimeType: "application/pdf" }, { cliente: c });
    expect(r.nota.numero).toBe("1234");
    const pedido = c.parse.mock.calls[0][0];
    expect(pedido.model).toBe("claude-opus-5-5");
    expect(pedido.messages[0].content[0]).toMatchObject({ type: "document", source: { type: "base64", media_type: "application/pdf" } });
    expect(pedido.messages[0].content[0].source.data).toBe(PDF.toString("base64"));
  });

  it("envia foto como image", async () => {
    const c = clienteMock({ stop_reason: "end_turn", parsed_output: saidaBase() });
    await extrairNotaDeDocumento({ bytes: PNG, mimeType: "image/png" }, { cliente: c });
    expect(c.parse.mock.calls[0][0].messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/png" } });
  });

  it("não chama a IA com arquivo inválido", async () => {
    const c = clienteMock({});
    await expect(extrairNotaDeDocumento({ bytes: Buffer.from("oi"), mimeType: "image/png" }, { cliente: c })).rejects.toThrow(ErroExtracao);
    expect(c.parse).not.toHaveBeenCalled();
  });

  it("recusa, resposta cortada ou sem saída viram erro de leitura", async () => {
    for (const resp of [
      { stop_reason: "refusal", parsed_output: null },
      { stop_reason: "max_tokens", parsed_output: null },
      { stop_reason: "end_turn", parsed_output: null },
    ]) {
      const p = extrairNotaDeDocumento({ bytes: PDF, mimeType: "application/pdf" }, { cliente: clienteMock(resp) });
      await expect(p).rejects.toMatchObject({ codigo: "leitura" });
    }
  });

  it("sem ANTHROPIC_API_KEY: indisponível, com mensagem amigável", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(extrairNotaDeDocumento({ bytes: PDF, mimeType: "application/pdf" })).rejects.toMatchObject({
      codigo: "indisponivel",
      message: expect.stringMatching(/Digitar/),
    });
  });
});
