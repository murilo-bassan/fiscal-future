/**
 * Estado e regras do formulário de nota digitada (aba "Digitar" e "Corrigir
 * dados"). Os campos ficam como texto enquanto o usuário digita ("25,50") e
 * viram NotaManualEntrada só na hora de validar. Sem dependências de servidor.
 */

import { infoDaChave, notaManualSchema, type NotaManualEntrada } from "../../lib/nfe/entrada";
import { numeroBr } from "../../lib/planilhaNotas";

export type TipoNota = NotaManualEntrada["tipo"];
export const TRIBUTOS_NFE = ["icms", "pis", "cofins", "ipi"] as const;
export const TRIBUTOS_NFSE = ["iss", "pis", "cofins"] as const;
export type CampoTributo = "icms" | "pis" | "cofins" | "ipi" | "iss";

export type ItemForm = {
  id: string;
  descricao: string;
  ncm: string;
  cfop: string;
  codigoServico: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  desconto: string;
} & Record<CampoTributo, string>;

export type NotaForm = {
  tipo: TipoNota;
  chave: string;
  numero: string;
  serie: string;
  emissao: string;
  regimeEmitente: "simples" | "normal";
  emitenteDocumento: string;
  emitenteNome: string;
  emitenteUf: string;
  destinatarioDocumento: string;
  destinatarioNome: string;
  destinatarioUf: string;
  itens: ItemForm[];
};

/** Mensagens por caminho do schema: "emitente.nome", "itens.0.ncm". */
export type ErrosForm = Record<string, string>;

let seq = 0;
const novoId = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

export function itemVazio(): ItemForm {
  return {
    id: novoId(),
    descricao: "",
    ncm: "",
    cfop: "",
    codigoServico: "",
    unidade: "UN",
    quantidade: "1",
    valorUnitario: "",
    desconto: "",
    icms: "",
    pis: "",
    cofins: "",
    ipi: "",
    iss: "",
  };
}

export function formVazio(tipo: TipoNota = "nfe"): NotaForm {
  return {
    tipo,
    chave: "",
    numero: "",
    serie: "",
    emissao: "",
    regimeEmitente: "normal",
    emitenteDocumento: "",
    emitenteNome: "",
    emitenteUf: "",
    destinatarioDocumento: "",
    destinatarioNome: "",
    destinatarioUf: "",
    itens: [itemVazio()],
  };
}

/** Número para o campo de texto, com vírgula ("17,5"). Zero vira vazio nos campos opcionais. */
const texto = (v: unknown, vazioSeZero = true) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || (vazioSeZero && n === 0)) return "";
  return String(n).replace(".", ",");
};

/** Preenche o formulário com uma entrada guardada (para corrigir os dados). */
export function formDeEntrada(e: NotaManualEntrada): NotaForm {
  return {
    tipo: e.tipo,
    chave: e.chave ?? "",
    numero: e.numero ?? "",
    serie: e.serie ?? "",
    emissao: (e.emissao ?? "").slice(0, 10),
    regimeEmitente: e.regimeEmitente ?? "normal",
    emitenteDocumento: e.emitente.documento ?? "",
    emitenteNome: e.emitente.nome ?? "",
    emitenteUf: e.emitente.uf ?? "",
    destinatarioDocumento: e.destinatario?.documento ?? "",
    destinatarioNome: e.destinatario?.nome ?? "",
    destinatarioUf: e.destinatario?.uf ?? "",
    itens: e.itens.map((i) => ({
      id: novoId(),
      descricao: i.descricao,
      ncm: i.ncm ?? "",
      cfop: i.cfop ?? "",
      codigoServico: i.codigoServico ?? "",
      unidade: i.unidade ?? "UN",
      quantidade: texto(i.quantidade ?? 1, false) || "1",
      valorUnitario: texto(i.valorUnitario, false),
      desconto: texto(i.desconto),
      icms: texto(i.icms),
      pis: texto(i.pis),
      cofins: texto(i.cofins),
      ipi: texto(i.ipi),
      iss: texto(i.iss),
    })),
  };
}

/** Texto → número; vazio vira o padrão, texto inválido vira NaN (o schema acusa). */
export function lerNumero(s: string, padrao = 0): number {
  const n = numeroBr(s);
  return n === undefined ? padrao : n;
}

/** Valor do item antes dos tributos (quantidade × unitário − desconto), para o atalho de %. */
export function baseDoItem(it: ItemForm, tipo: TipoNota): number {
  const q = tipo === "nfse" ? 1 : lerNumero(it.quantidade, 1);
  const v = q * lerNumero(it.valorUnitario) - lerNumero(it.desconto);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

/** Atalho de "%": alíquota sobre o valor do item, em R$ com 2 casas. */
export function valorDaAliquota(base: number, aliquota: string): number | null {
  const a = numeroBr(aliquota.replace("%", ""));
  if (a === undefined || Number.isNaN(a) || a < 0 || a > 100) return null;
  return Math.round(base * a) / 100;
}

export function entradaDoForm(f: NotaForm): NotaManualEntrada {
  const servico = f.tipo === "nfse";
  const temDest = f.destinatarioDocumento.trim() || f.destinatarioNome.trim();
  return {
    tipo: f.tipo,
    chave: f.chave,
    numero: f.numero,
    serie: f.serie,
    emissao: f.emissao,
    regimeEmitente: f.regimeEmitente,
    emitente: { documento: f.emitenteDocumento, nome: f.emitenteNome, uf: f.emitenteUf },
    destinatario: temDest ? { documento: f.destinatarioDocumento, nome: f.destinatarioNome, uf: f.destinatarioUf } : undefined,
    itens: f.itens.map((i) => ({
      descricao: i.descricao,
      ncm: servico ? "" : i.ncm,
      cfop: servico ? "" : i.cfop,
      codigoServico: servico ? i.codigoServico : "",
      unidade: i.unidade || "UN",
      quantidade: servico ? 1 : lerNumero(i.quantidade, 1),
      valorUnitario: i.valorUnitario.trim() === "" ? Number.NaN : lerNumero(i.valorUnitario),
      desconto: servico ? 0 : lerNumero(i.desconto),
      icms: servico ? 0 : lerNumero(i.icms),
      pis: lerNumero(i.pis),
      cofins: lerNumero(i.cofins),
      ipi: servico ? 0 : lerNumero(i.ipi),
      iss: servico ? lerNumero(i.iss) : 0,
    })),
  };
}

const MSG_NUMERO = "Informe um número (ex.: 25,50)";

/** Valida com o mesmo schema do servidor e devolve as mensagens por campo. */
export function validarForm(f: NotaForm): { ok: true; nota: NotaManualEntrada } | { ok: false; erros: ErrosForm } {
  const nota = entradaDoForm(f);
  const r = notaManualSchema.safeParse(nota);
  if (r.success) return { ok: true, nota };
  const erros: ErrosForm = {};
  for (const i of r.error.issues) {
    const k = i.path.join(".");
    const numerico = /^itens\.\d+\.(quantidade|valorUnitario|desconto|icms|pis|cofins|ipi|iss)$/.test(k);
    erros[k] ??= numerico && /expected number|NaN|Invalid input/i.test(i.message) ? MSG_NUMERO : i.message;
  }
  return { ok: false, erros };
}

/**
 * Chave colada: preenche o que a chave diz (UF, mês, CNPJ do emitente,
 * modelo, série e número) sem apagar o que o usuário já digitou.
 */
export function aplicarChave(f: NotaForm, chave: string): { form: NotaForm; lida: boolean; valida: boolean } {
  const info = infoDaChave(chave);
  if (!info) return { form: { ...f, chave }, lida: false, valida: false };
  const tipo: TipoNota = info.modelo === "65" ? "nfce" : info.modelo === "55" ? "nfe" : f.tipo;
  return {
    lida: true,
    valida: info.valida,
    form: {
      ...f,
      chave,
      tipo,
      emitenteUf: f.emitenteUf || info.uf || "",
      emitenteDocumento: f.emitenteDocumento || info.cnpjEmitente,
      serie: f.serie || info.serie,
      numero: f.numero || info.numero,
      emissao: f.emissao || `${info.anoMes}-01`,
    },
  };
}
