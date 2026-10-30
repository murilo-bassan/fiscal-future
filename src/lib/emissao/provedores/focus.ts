/**
 * Adaptador da API Focus NFe (v2).
 *
 * CONFIRMADO NA DOCUMENTAÇÃO OFICIAL (doc.focusnfe.com.br e campos.focusnfe.com.br, out/2026):
 *  - URLs: homologação https://homologacao.focusnfe.com.br/v2, produção https://api.focusnfe.com.br/v2.
 *  - Autenticação: HTTP Basic, token da empresa como usuário e senha em branco ("token:").
 *  - NF-e: POST /nfe?ref=REF (201 autorizada síncrona; 202 processando_autorizacao);
 *    GET /nfe/REF (?completa=1 traz protocolo); DELETE /nfe/REF com {"justificativa"} (15 a 255
 *    caracteres; até 24 h após a emissão). Status: processando_autorizacao, autorizado, cancelado,
 *    erro_autorizacao; no cancelamento, cancelado ou erro_cancelamento.
 *  - Campos NF-e usados: natureza_operacao, data_emissao, tipo_documento, finalidade_emissao,
 *    local_destino, consumidor_final, presenca_comprador, cnpj_emitente, inscricao_estadual_emitente,
 *    regime_tributario_emitente, nome_destinatario, cnpj_destinatario/cpf_destinatario,
 *    inscricao_estadual_destinatario, indicador_inscricao_estadual_destinatario, *_destinatario do
 *    endereço, codigo_municipio_destinatario, valor_produtos, valor_desconto, valor_total,
 *    modalidade_frete, items[] (numero_item, codigo_produto, descricao, cfop, codigo_ncm,
 *    unidade_comercial, quantidade_comercial, valor_unitario_comercial, valor_bruto,
 *    unidade_tributavel, quantidade_tributavel, valor_unitario_tributavel, valor_desconto,
 *    inclui_no_total, icms_origem, icms_situacao_tributaria, icms_modalidade_base_calculo,
 *    icms_base_calculo, icms_aliquota, icms_valor, pis_*, cofins_*).
 *  - IBS/CBS por item (tabela de campos NF-e): ibs_cbs_situacao_tributaria (CST),
 *    ibs_cbs_classificacao_tributaria (cClassTrib), ibs_cbs_base_calculo, ibs_uf_aliquota,
 *    ibs_uf_percentual_reducao_aliquota, ibs_uf_aliquota_efetiva, ibs_uf_valor, ibs_mun_* (idem),
 *    ibs_valor_total, cbs_aliquota, cbs_percentual_reducao_aliquota, cbs_aliquota_efetiva, cbs_valor.
 *    Totais: ibs_cbs_base_calculo, ibs_uf_valor_total, ibs_mun_valor_total, ibs_valor_total, cbs_valor_total.
 *  - Respostas NF-e: status, status_sefaz, mensagem_sefaz, chave_nfe, numero, serie,
 *    caminho_xml_nota_fiscal, caminho_danfe; erros com codigo, mensagem, erros[{campo, mensagem}].
 *    422 com codigo already_processed / pending_operation indica ref já enviada.
 *  - NFS-e nacional: POST /nfsen?ref=REF (202 com status e protocolo), GET /nfsen/REF,
 *    DELETE /nfsen/REF com {"justificativa"}. Status: processando_autorizacao, autorizado, negado,
 *    cancelado, erro_autorizacao (cancelamento: cancelado ou erro_cancelamento). Resposta: numero,
 *    codigo_verificacao, url, url_danfse, caminho_xml_nota_fiscal, erros[{codigo, mensagem, correcao}].
 *  - Campos NFS-e usados: data_emissao, data_competencia, codigo_municipio_emissora, cnpj_prestador,
 *    inscricao_municipal_prestador, codigo_opcao_simples_nacional (1 não optante, 2 MEI, 3 ME/EPP),
 *    regime_tributario_simples_nacional, regime_especial_tributacao, cnpj_tomador/cpf_tomador,
 *    razao_social_tomador, codigo_municipio_tomador, cep_tomador, logradouro_tomador, numero_tomador,
 *    bairro_tomador, email_tomador, codigo_municipio_prestacao, codigo_tributacao_nacional_iss,
 *    codigo_nbs, descricao_servico, valor_servico, tributacao_iss (1 = tributável), tipo_retencao_iss,
 *    percentual_aliquota_relativa_municipio, ibs_cbs_situacao_tributaria,
 *    ibs_cbs_classificacao_tributaria, finalidade_emissao (0 = regular), consumidor_final,
 *    indicador_destinatario.
 *
 * SUPOSIÇÕES (validar em homologação antes de produção):
 *  - Percentuais vão em pontos percentuais com 4 casas (18% = "18.0000"; CBS 0,9% = "0.9000"),
 *    como nas tags pICMS/pIBSUF/pCBS do XML. A doc só diz Decimal[3.2-4].
 *  - Caminhos "caminho_*" são relativos ao host da API (sem /v2); montamos a URL absoluta.
 *  - Protocolo da NF-e: campo "protocolo" ou protocolo_nota_fiscal.numero_protocolo (com completa=1).
 *  - Chave da NFS-e: não há campo próprio; lemos o parâmetro "chave=" da "url" de consulta.
 *  - Emitente do Simples em 2026: não enviamos o grupo IBS/CBS na NF-e (obrigatório para o Simples
 *    só a partir de 2027). Regime normal: sempre enviamos.
 *  - CSOSN 102 para o Simples; CST 00 de ICMS no regime normal com alíquota > 0 e CST 41 sem alíquota;
 *    PIS/Cofins CST 01 quando há valor e 49 quando não há. Confirme com o contador da empresa.
 *  - presenca_comprador = 9 (outros, não presencial) e modalidade_frete = 9 (sem frete).
 *  - NFS-e: os valores de IBS/CBS não têm campo de entrada na DPS documentada (o Sistema Nacional
 *    calcula a partir de CST/cClassTrib); enviamos só a classificação. codigo_indicador_operacao
 *    (cIndOp) não é enviado: confirme se a prefeitura/ambiente exige.
 *  - NFS-e: valor_servico vai líquido do desconto; regime_especial_tributacao = 0;
 *    regime_tributario_simples_nacional = 1 (apuração pelo SN) para optantes; indicador_destinatario = 0.
 *  - NFS-e: percentual_aliquota_relativa_municipio recebe a alíquota de ISS (pAliq).
 *  - informacoes_adicionais_contribuinte (infCpl) e email_destinatario: nomes seguem o padrão da
 *    tabela de campos, mas não apareceram na página de emissão que lemos.
 *  - Cancelamento de NFS-e: enviamos só a justificativa (a doc cita um "código de cancelamento" sem nome do campo).
 */

import type { CalculoRascunho } from "../calculo";
import type { IbsCbsItem } from "../../nfe/calculo";
import type {
  EmitenteFiscal,
  ProvedorFiscal,
  RascunhoNota,
  ResultadoEmissao,
  StatusNota,
  TipoNota,
} from "../tipos";

export const URLS_FOCUS = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
} as const;

const TIMEOUT_MS = 20_000;

type Json = Record<string, unknown>;
type Fetch = typeof fetch;

const v2 = (n: number) => Number(n.toFixed(2));
const pct = (fracao: number) => (fracao * 100).toFixed(4);
const hoje = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
const dataHora = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 19) + "-03:00";

/** Campos IBS/CBS de um item, exatamente com os valores do cálculo. */
function camposIbsCbs(t: IbsCbsItem): Json {
  const c: Json = {
    ibs_cbs_situacao_tributaria: t.cst,
    ibs_cbs_classificacao_tributaria: t.cClassTrib,
  };
  if (!t.temGrupo) return c;
  const parcela = (prefixo: "ibs_uf" | "ibs_mun" | "cbs", p: IbsCbsItem["cbs"]) => {
    c[`${prefixo}_aliquota`] = pct(p.aliquota);
    if (p.reducao > 0) {
      c[`${prefixo}_percentual_reducao_aliquota`] = pct(p.reducao);
      c[`${prefixo}_aliquota_efetiva`] = pct(p.aliquotaEfetiva);
    }
    c[`${prefixo}_valor`] = v2(p.valor);
  };
  c.ibs_cbs_base_calculo = v2(t.base);
  parcela("ibs_uf", t.ibsUf);
  parcela("ibs_mun", t.ibsMun);
  c.ibs_valor_total = v2(t.vIBS);
  parcela("cbs", t.cbs);
  return c;
}

function enviaIbsCbs(c: CalculoRascunho) {
  return !(c.simples && c.ano <= 2026);
}

export function payloadNfe(e: EmitenteFiscal, r: RascunhoNota, c: CalculoRascunho, agora = new Date()): Json {
  const d = r.destinatario;
  const end = d.endereco ?? {};
  const doc = d.documento.length === 11 ? { cpf_destinatario: d.documento } : { cnpj_destinatario: d.documento };
  const comIbsCbs = enviaIbsCbs(c);

  const items = r.itens.map((it, i) => {
    const ci = c.itens[i];
    const item: Json = {
      numero_item: i + 1,
      codigo_produto: it.codigo,
      descricao: it.descricao,
      cfop: it.cfop,
      codigo_ncm: it.ncm,
      unidade_comercial: it.unidade,
      quantidade_comercial: it.quantidade,
      valor_unitario_comercial: it.valorUnitario,
      valor_bruto: v2(it.quantidade * it.valorUnitario),
      unidade_tributavel: it.unidade,
      quantidade_tributavel: it.quantidade,
      valor_unitario_tributavel: it.valorUnitario,
      inclui_no_total: 1,
      icms_origem: 0,
    };
    if (it.desconto > 0) item.valor_desconto = v2(it.desconto);

    if (c.simples) {
      item.icms_situacao_tributaria = "102";
    } else if ((it.aliquotaIcms ?? 0) > 0) {
      item.icms_situacao_tributaria = "00";
      item.icms_modalidade_base_calculo = 3;
      item.icms_base_calculo = v2(ci.valor);
      item.icms_aliquota = pct(it.aliquotaIcms ?? 0);
      item.icms_valor = v2(ci.icms);
    } else {
      item.icms_situacao_tributaria = "41";
    }

    if (ci.pis > 0) {
      item.pis_situacao_tributaria = "01";
      item.pis_base_calculo = v2(ci.valor);
      item.pis_aliquota_porcentual = pct(ci.pis / ci.valor);
      item.pis_valor = v2(ci.pis);
    } else item.pis_situacao_tributaria = "49";
    if (ci.cofins > 0) {
      item.cofins_situacao_tributaria = "01";
      item.cofins_base_calculo = v2(ci.valor);
      item.cofins_aliquota_porcentual = pct(ci.cofins / ci.valor);
      item.cofins_valor = v2(ci.cofins);
    } else item.cofins_situacao_tributaria = "49";

    return comIbsCbs ? { ...item, ...camposIbsCbs(ci.ibsCbs) } : item;
  });

  const p: Json = {
    natureza_operacao: r.naturezaOperacao,
    data_emissao: dataHora(agora),
    tipo_documento: 1,
    finalidade_emissao: 1,
    local_destino: end.uf && end.uf !== e.endereco.uf ? 2 : 1,
    consumidor_final: d.consumidorFinal ? 1 : 0,
    presenca_comprador: 9,
    cnpj_emitente: e.cnpj,
    inscricao_estadual_emitente: e.inscricaoEstadual,
    regime_tributario_emitente: Number(e.crt),
    nome_destinatario: d.nome,
    ...doc,
    indicador_inscricao_estadual_destinatario: d.inscricaoEstadual ? 1 : 9,
    inscricao_estadual_destinatario: d.inscricaoEstadual,
    email_destinatario: d.email,
    logradouro_destinatario: end.logradouro,
    numero_destinatario: end.numero,
    bairro_destinatario: end.bairro,
    municipio_destinatario: end.municipio,
    codigo_municipio_destinatario: end.codigoMunicipio,
    uf_destinatario: end.uf,
    cep_destinatario: end.cep,
    pais_destinatario: "Brasil",
    modalidade_frete: 9,
    valor_produtos: v2(c.totais.produtos),
    valor_desconto: v2(c.totais.desconto),
    valor_total: v2(c.totais.nota),
    informacoes_adicionais_contribuinte: r.informacoesAdicionais,
    items,
  };
  if (comIbsCbs) {
    p.ibs_cbs_base_calculo = v2(c.totais.base);
    p.ibs_uf_valor_total = v2(c.totais.ibsUf);
    p.ibs_mun_valor_total = v2(c.totais.ibsMun);
    p.ibs_valor_total = v2(c.totais.ibs);
    p.cbs_valor_total = v2(c.totais.cbs);
  }
  return semVazios(p);
}

export function payloadNfse(e: EmitenteFiscal, r: RascunhoNota, c: CalculoRascunho, agora = new Date()): Json {
  const it = r.itens[0];
  const ci = c.itens[0];
  const d = r.destinatario;
  const end = d.endereco ?? {};
  const simples = e.crt !== "3";
  const p: Json = {
    data_emissao: dataHora(agora),
    data_competencia: hoje(agora),
    codigo_municipio_emissora: e.endereco.codigoMunicipio,
    cnpj_prestador: e.cnpj,
    inscricao_municipal_prestador: e.inscricaoMunicipal,
    codigo_opcao_simples_nacional: e.crt === "4" ? 2 : simples ? 3 : 1,
    regime_tributario_simples_nacional: simples ? 1 : undefined,
    regime_especial_tributacao: 0,
    ...(d.documento.length === 11 ? { cpf_tomador: d.documento } : { cnpj_tomador: d.documento }),
    razao_social_tomador: d.nome,
    codigo_municipio_tomador: end.codigoMunicipio,
    cep_tomador: end.cep,
    logradouro_tomador: end.logradouro,
    numero_tomador: end.numero,
    bairro_tomador: end.bairro,
    email_tomador: d.email,
    codigo_municipio_prestacao: e.endereco.codigoMunicipio,
    codigo_tributacao_nacional_iss: it.codigoServico,
    codigo_nbs: it.nbs,
    descricao_servico: it.descricao,
    valor_servico: v2(ci.valor),
    tributacao_iss: 1,
    tipo_retencao_iss: 1,
    percentual_aliquota_relativa_municipio:
      e.aliquotaIssPadrao != null ? Number((e.aliquotaIssPadrao * 100).toFixed(2)) : undefined,
    ibs_cbs_situacao_tributaria: ci.ibsCbs.cst,
    ibs_cbs_classificacao_tributaria: ci.ibsCbs.cClassTrib,
    finalidade_emissao: 0,
    consumidor_final: d.consumidorFinal ? 1 : 0,
    indicador_destinatario: 0,
  };
  return semVazios(p);
}

function semVazios(o: Json): Json {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

const STATUS: Record<string, StatusNota> = {
  processando_autorizacao: "processando",
  autorizado: "autorizada",
  cancelado: "cancelada",
  erro_autorizacao: "rejeitada",
  negado: "rejeitada",
  denegado: "rejeitada",
};

export function mapearStatus(s: unknown): StatusNota | undefined {
  return typeof s === "string" ? STATUS[s] : undefined;
}

function mensagemDe(j: Json): string | undefined {
  const partes: string[] = [];
  if (typeof j.mensagem_sefaz === "string") partes.push(j.mensagem_sefaz);
  if (typeof j.mensagem === "string") partes.push(j.mensagem);
  if (Array.isArray(j.erros)) {
    for (const er of j.erros as Json[]) {
      const m = [er.campo, er.mensagem].filter((x) => typeof x === "string" && x).join(": ");
      if (m) partes.push(m + (typeof er.correcao === "string" && er.correcao ? ` (${er.correcao})` : ""));
    }
  }
  return partes.length ? partes.join(" | ").slice(0, 1000) : undefined;
}

function absoluta(base: string, caminho: unknown): string | undefined {
  if (typeof caminho !== "string" || !caminho) return undefined;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return base + (caminho.startsWith("/") ? caminho : `/${caminho}`);
}

function chaveDaUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const m = /[?&]chave=(\d{44,50})/.exec(url);
  return m?.[1];
}

export function resultadoDe(tipo: TipoNota, base: string, j: Json): ResultadoEmissao {
  const status = mapearStatus(j.status) ?? "processando";
  const protocoloNf = (j.protocolo_nota_fiscal as Json | undefined)?.numero_protocolo;
  const protocolo = j.protocolo ?? protocoloNf ?? (tipo === "nfse" ? j.codigo_verificacao : undefined);
  const r: ResultadoEmissao = {
    status,
    numero: j.numero != null ? String(j.numero) : undefined,
    serie: j.serie != null ? String(j.serie) : undefined,
    chave: typeof j.chave_nfe === "string" ? j.chave_nfe : chaveDaUrl(j.url),
    protocolo: protocolo != null ? String(protocolo) : undefined,
    mensagem: mensagemDe(j),
    xmlUrl: absoluta(base, j.caminho_xml_nota_fiscal),
    danfeUrl: tipo === "nfe" ? absoluta(base, j.caminho_danfe) : (absoluta(base, j.url_danfse) ?? absoluta(base, j.url)),
  };
  if (!mapearStatus(j.status) && typeof j.status === "string") {
    r.mensagem = [`Situação no provedor: ${j.status}`, r.mensagem].filter(Boolean).join(" | ");
  }
  return r;
}

export class ErroRedeFocus extends Error {}

export function criarProvedorFocus(opcoes: { fetch?: Fetch; timeoutMs?: number; agora?: () => Date } = {}): ProvedorFiscal {
  const f: Fetch = opcoes.fetch ?? ((...a) => fetch(...a));
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_MS;
  const agora = opcoes.agora ?? (() => new Date());

  async function chamar(
    e: EmitenteFiscal,
    metodo: "GET" | "POST" | "DELETE",
    caminho: string,
    corpo?: Json,
  ): Promise<{ http: number; json: Json; base: string }> {
    if (!e.provedorToken) throw new ErroRedeFocus("Token do Focus NFe não configurado.");
    const base = URLS_FOCUS[e.ambiente];
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeoutMs);
    try {
      const resp = await f(`${base}/v2${caminho}`, {
        method: metodo,
        headers: {
          Authorization: `Basic ${Buffer.from(`${e.provedorToken}:`).toString("base64")}`,
          Accept: "application/json",
          ...(corpo ? { "Content-Type": "application/json" } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: controle.signal,
        cache: "no-store",
      });
      const texto = await resp.text();
      let json: Json = {};
      try {
        json = texto ? (JSON.parse(texto) as Json) : {};
      } catch {
        json = { mensagem: texto.slice(0, 300) };
      }
      return { http: resp.status, json, base };
    } catch (err) {
      // Nunca incluir headers (token) na mensagem
      const abortou = err instanceof Error && err.name === "AbortError";
      throw new ErroRedeFocus(
        abortou ? "O Focus NFe não respondeu a tempo." : "Não foi possível falar com o Focus NFe.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  const rota = (tipo: TipoNota) => (tipo === "nfe" ? "/nfe" : "/nfsen");

  async function consultar(e: EmitenteFiscal, tipo: TipoNota, ref: string): Promise<ResultadoEmissao> {
    const q = tipo === "nfe" ? "?completa=1" : "";
    const { http, json, base } = await chamar(e, "GET", `${rota(tipo)}/${encodeURIComponent(ref)}${q}`);
    if (http === 401) return { status: "erro", mensagem: "Token do Focus NFe recusado. Confira o token nos dados fiscais." };
    if (http === 404) return { status: "erro", mensagem: mensagemDe(json) ?? "Nota não encontrada no Focus NFe." };
    if (http >= 500) return { status: "processando", mensagem: "O Focus NFe está instável. Tente atualizar daqui a pouco." };
    return resultadoDe(tipo, base, json);
  }

  return {
    id: "focus",
    nome: "Focus NFe",

    async emitir(e, r, calculo, ref) {
      const corpo = r.tipo === "nfe" ? payloadNfe(e, r, calculo, agora()) : payloadNfse(e, r, calculo, agora());
      let resp;
      try {
        resp = await chamar(e, "POST", `${rota(r.tipo)}?ref=${encodeURIComponent(ref)}`, corpo);
      } catch (err) {
        // O envio pode ter chegado: fica "processando" e a consulta resolve (a ref é idempotente)
        return {
          status: "processando",
          mensagem: `${err instanceof Error ? err.message : "Falha de comunicação."} Use "Atualizar status" em instantes.`,
        };
      }
      const { http, json, base } = resp;
      const codigo = typeof json.codigo === "string" ? json.codigo : "";
      if (codigo === "already_processed" || codigo === "pending_operation") return consultar(e, r.tipo, ref);
      if (http === 401) return { status: "erro", mensagem: "Token do Focus NFe recusado. Confira o token nos dados fiscais." };
      if (http >= 500) return { status: "processando", mensagem: "O Focus NFe está instável. Use \"Atualizar status\" em instantes." };
      if (http >= 400) {
        // Recusada antes de chegar à SEFAZ/prefeitura: dados inválidos
        return { status: "erro", mensagem: mensagemDe(json) ?? `O Focus NFe recusou a nota (HTTP ${http}).` };
      }
      return resultadoDe(r.tipo, base, json);
    },

    consultar,

    async cancelar(e, tipo, ref, justificativa) {
      const { http, json, base } = await chamar(e, "DELETE", `${rota(tipo)}/${encodeURIComponent(ref)}`, { justificativa });
      if (http === 401) return { status: "autorizada", mensagem: "Token do Focus NFe recusado. Confira o token nos dados fiscais." };
      if (json.status === "erro_cancelamento" || http >= 400) {
        return {
          status: "autorizada",
          mensagem: `Cancelamento não aceito: ${mensagemDe(json) ?? `HTTP ${http}`}`,
        };
      }
      return resultadoDe(tipo, base, json);
    },
  };
}

export const provedorFocus = criarProvedorFocus();
