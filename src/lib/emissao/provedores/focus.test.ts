import { describe, expect, it, vi } from "vitest";
import { calcularRascunho } from "../calculo";
import { EMITENTE_NORMAL as E, NFE, NFSE } from "../fixtures.test-utils";
import { criarProvedorFocus, mapearStatus, payloadNfe } from "./focus";

type Chamada = { url: string; init: RequestInit };

function fetchFalso(respostas: { status: number; body: unknown }[]) {
  const chamadas: Chamada[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    const r = respostas.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  });
  return { f: f as unknown as typeof fetch, chamadas };
}

const agora = () => new Date("2026-10-30T13:00:00Z");

describe("provedor Focus NFe", () => {
  it("monta o payload da NF-e com os valores do cálculo, sem recalcular", async () => {
    const c = calcularRascunho(E, NFE, { ano: 2027 });
    const { f, chamadas } = fetchFalso([{ status: 202, body: { status: "processando_autorizacao", ref: "ff-1" } }]);
    const r = await criarProvedorFocus({ fetch: f, agora }).emitir(E, NFE, c, "ff-1");

    expect(r.status).toBe("processando");
    expect(chamadas).toHaveLength(1);
    const { url, init } = chamadas[0];
    expect(url).toBe("https://homologacao.focusnfe.com.br/v2/nfe?ref=ff-1");
    expect(init.method).toBe("POST");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from("TOKEN-SECRETO-123:").toString("base64")}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const p = JSON.parse(String(init.body));
    expect(p).toMatchObject({
      natureza_operacao: "Venda de mercadoria",
      tipo_documento: 1,
      finalidade_emissao: 1,
      local_destino: 2,
      consumidor_final: 0,
      cnpj_emitente: E.cnpj,
      cnpj_destinatario: "11444777000161",
      indicador_inscricao_estadual_destinatario: 1,
      valor_total: c.totais.nota,
      ibs_cbs_base_calculo: c.totais.base,
      cbs_valor_total: c.totais.cbs,
      ibs_valor_total: c.totais.ibs,
    });
    const [i1, i2] = p.items;
    const c1 = c.itens[0];
    expect(i1).toMatchObject({
      numero_item: 1,
      codigo_ncm: "73181500",
      cfop: "6102",
      valor_bruto: 1000,
      icms_situacao_tributaria: "00",
      icms_aliquota: "12.0000",
      icms_valor: c1.icms,
      ibs_cbs_situacao_tributaria: c1.ibsCbs.cst,
      ibs_cbs_classificacao_tributaria: c1.ibsCbs.cClassTrib,
      ibs_cbs_base_calculo: c1.ibsCbs.base,
      ibs_uf_aliquota: (c1.ibsCbs.ibsUf.aliquota * 100).toFixed(4),
      ibs_uf_valor: c1.ibsCbs.ibsUf.valor,
      ibs_mun_valor: c1.ibsCbs.ibsMun.valor,
      cbs_aliquota: (c1.ibsCbs.cbs.aliquota * 100).toFixed(4),
      cbs_valor: c1.ibsCbs.cbs.valor,
      ibs_valor_total: c1.ibsCbs.vIBS,
    });
    expect(i1.cbs_percentual_reducao_aliquota).toBeUndefined();
    // Cesta básica: redução de 100%
    expect(i2.cbs_percentual_reducao_aliquota).toBe("100.0000");
    expect(i2.cbs_valor).toBe(0);
    expect(i2.valor_desconto).toBe(10);
  });

  it("emitente do Simples em 2026 não envia o grupo IBS/CBS", () => {
    const simples = { ...E, crt: "1" as const, regime: "simples" as const };
    const p = payloadNfe(simples, NFE, calcularRascunho(simples, NFE, { ano: 2026 }), agora());
    const items = p.items as Record<string, unknown>[];
    expect(items[0].icms_situacao_tributaria).toBe("102");
    expect(items[0].ibs_cbs_situacao_tributaria).toBeUndefined();
    expect(p.cbs_valor_total).toBeUndefined();
  });

  it("NFS-e nacional: rota /nfsen e campos da DPS", async () => {
    const c = calcularRascunho(E, NFSE, { ano: 2026 });
    const { f, chamadas } = fetchFalso([{ status: 202, body: { status: "processando_autorizacao", protocolo: "abc" } }]);
    const r = await criarProvedorFocus({ fetch: f, agora }).emitir({ ...E, ambiente: "producao" }, NFSE, c, "ff-2");
    expect(r.status).toBe("processando");
    expect(chamadas[0].url).toBe("https://api.focusnfe.com.br/v2/nfsen?ref=ff-2");
    const p = JSON.parse(String(chamadas[0].init.body));
    expect(p).toMatchObject({
      cnpj_prestador: E.cnpj,
      inscricao_municipal_prestador: "12345",
      codigo_opcao_simples_nacional: 1,
      cpf_tomador: "52998224725",
      codigo_municipio_prestacao: "3550308",
      codigo_tributacao_nacional_iss: "010101",
      codigo_nbs: "115022000",
      valor_servico: 1000,
      tributacao_iss: 1,
      percentual_aliquota_relativa_municipio: 5,
      ibs_cbs_situacao_tributaria: c.itens[0].ibsCbs.cst,
      consumidor_final: 1,
      data_competencia: "2026-10-30",
    });
  });

  it("consulta mapeia autorizado e monta URLs absolutas", async () => {
    const { f, chamadas } = fetchFalso([
      {
        status: 200,
        body: {
          status: "autorizado",
          numero: "10",
          serie: "1",
          chave_nfe: "35261011222333000181550010000000101000042420",
          protocolo: "135260000000001",
          caminho_xml_nota_fiscal: "/arquivos/x.xml",
          caminho_danfe: "/arquivos/x.pdf",
        },
      },
    ]);
    const r = await criarProvedorFocus({ fetch: f }).consultar(E, "nfe", "ff-1");
    expect(chamadas[0].url).toBe("https://homologacao.focusnfe.com.br/v2/nfe/ff-1?completa=1");
    expect(chamadas[0].init.method).toBe("GET");
    expect(r).toMatchObject({
      status: "autorizada",
      numero: "10",
      protocolo: "135260000000001",
      xmlUrl: "https://homologacao.focusnfe.com.br/arquivos/x.xml",
      danfeUrl: "https://homologacao.focusnfe.com.br/arquivos/x.pdf",
    });
  });

  it("cancelamento envia DELETE com justificativa e trata recusa", async () => {
    const { f, chamadas } = fetchFalso([
      { status: 200, body: { status: "cancelado" } },
      { status: 200, body: { status: "erro_cancelamento", mensagem_sefaz: "Prazo excedido" } },
    ]);
    const p = criarProvedorFocus({ fetch: f });
    expect((await p.cancelar(E, "nfe", "ff-1", "Cliente desistiu da compra")).status).toBe("cancelada");
    expect(chamadas[0].init.method).toBe("DELETE");
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ justificativa: "Cliente desistiu da compra" });
    const r = await p.cancelar(E, "nfe", "ff-1", "Cliente desistiu da compra");
    expect(r.status).toBe("autorizada");
    expect(r.mensagem).toContain("Prazo excedido");
  });

  it("422 de validação vira erro; ref já processada consulta", async () => {
    const { f } = fetchFalso([
      { status: 422, body: { codigo: "erro_validacao_schema", mensagem: "Campo inválido", erros: [{ campo: "cfop", mensagem: "inválido" }] } },
      { status: 422, body: { codigo: "already_processed" } },
      { status: 200, body: { status: "autorizado", numero: "3" } },
    ]);
    const p = criarProvedorFocus({ fetch: f });
    const c = calcularRascunho(E, NFE, { ano: 2026 });
    const r1 = await p.emitir(E, NFE, c, "ff-9");
    expect(r1.status).toBe("erro");
    expect(r1.mensagem).toContain("cfop: inválido");
    const r2 = await p.emitir(E, NFE, c, "ff-9");
    expect(r2.status).toBe("autorizada");
  });

  it("timeout não vaza o token e deixa a nota processando", async () => {
    const f = vi.fn((_u: unknown, init?: RequestInit) => {
      return new Promise<Response>((_, rej) => {
        init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    }) as unknown as typeof fetch;
    const r = await criarProvedorFocus({ fetch: f, timeoutMs: 10 }).emitir(E, NFE, calcularRascunho(E, NFE), "ff-t");
    expect(r.status).toBe("processando");
    expect(r.mensagem).not.toContain("TOKEN");
  });

  it("mapeia status", () => {
    expect(mapearStatus("erro_autorizacao")).toBe("rejeitada");
    expect(mapearStatus("negado")).toBe("rejeitada");
    expect(mapearStatus("cancelado")).toBe("cancelada");
    expect(mapearStatus("xyz")).toBeUndefined();
  });
});
