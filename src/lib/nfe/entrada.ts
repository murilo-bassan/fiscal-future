/**
 * Entradas de nota sem XML: digitada à mão, extraída de PDF/foto (DANFE, DANFSE,
 * NFS-e municipal) ou importada de planilha. Todas viram o mesmo NotaLida que o
 * XML produz, então cálculo, comparação e emissão são os mesmos.
 */

import { z } from "zod";
import { chaveValida } from "../emissao/chave";
import type { FonteNota, ItemLido, NotaLida } from "./parser";

const digitos = (s: string) => s.replace(/\D/g, "");
const valor = z.coerce.number().min(0).max(1e10).default(0);
const opcionalDigitos = (n: number[], msg: string) =>
  z
    .string()
    .trim()
    .transform(digitos)
    .refine((s) => s === "" || n.includes(s.length), msg)
    .optional()
    .default("");

export const itemManualSchema = z.object({
  descricao: z.string().trim().min(2, "Descreva o item").max(300),
  codigo: z.string().trim().max(60).optional().default(""),
  ncm: opcionalDigitos([8], "NCM tem 8 dígitos"),
  cfop: opcionalDigitos([4], "CFOP tem 4 dígitos"),
  /** NFS-e: código do serviço (lista da LC 116 ou código nacional). */
  codigoServico: z.string().trim().max(20).optional().default(""),
  unidade: z.string().trim().max(6).optional().default("UN"),
  quantidade: z.coerce.number().positive("Quantidade maior que zero").max(1e9).default(1),
  valorUnitario: z.coerce.number().min(0).max(1e10),
  desconto: valor,
  // Tributos destacados na nota antiga, em reais
  icms: valor,
  pis: valor,
  cofins: valor,
  ipi: valor,
  iss: valor,
});

export const notaManualSchema = z.object({
  tipo: z.enum(["nfe", "nfce", "nfse"]),
  chave: opcionalDigitos([44], "A chave de acesso tem 44 dígitos").refine(
    (c) => !c || chaveValida(c),
    "Chave de acesso com dígito verificador errado",
  ),
  numero: z.string().trim().max(15).optional().default(""),
  serie: z.string().trim().max(5).optional().default(""),
  emissao: z.string().trim().max(30).optional().default(""),
  naturezaOperacao: z.string().trim().max(120).optional().default(""),
  /** Simples Nacional (CRT 1) ou regime normal (CRT 3). */
  regimeEmitente: z.enum(["simples", "normal"]).default("normal"),
  emitente: z.object({
    documento: opcionalDigitos([11, 14], "CPF tem 11 dígitos e CNPJ, 14"),
    nome: z.string().trim().min(1, "Informe o emitente").max(120),
    uf: z.string().trim().toUpperCase().max(2).optional().default(""),
  }),
  destinatario: z
    .object({
      documento: opcionalDigitos([11, 14], "CPF tem 11 dígitos e CNPJ, 14"),
      nome: z.string().trim().max(120).optional().default(""),
      uf: z.string().trim().toUpperCase().max(2).optional().default(""),
    })
    .optional(),
  itens: z.array(itemManualSchema).min(1, "Inclua pelo menos um item").max(990),
});

export type NotaManual = z.infer<typeof notaManualSchema>;
export type NotaManualEntrada = z.input<typeof notaManualSchema>;

const UF_POR_CODIGO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

export type InfoChave = {
  valida: boolean;
  uf?: string;
  anoMes: string; // AAAA-MM
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
};

/**
 * Lê o que a chave de acesso de 44 dígitos já diz sobre a nota (UF, mês,
 * CNPJ do emitente, modelo, série e número). Os itens não estão na chave:
 * baixar o XML pela chave exige certificado digital ou um provedor.
 */
export function infoDaChave(chave: string): InfoChave | null {
  const c = digitos(chave);
  if (c.length !== 44) return null;
  return {
    valida: chaveValida(c),
    uf: UF_POR_CODIGO[c.slice(0, 2)],
    anoMes: `20${c.slice(2, 4)}-${c.slice(4, 6)}`,
    cnpjEmitente: c.slice(6, 20),
    modelo: c.slice(20, 22),
    serie: String(Number(c.slice(22, 25))),
    numero: String(Number(c.slice(25, 34))),
  };
}

const MODELO: Record<NotaManual["tipo"], NotaLida["modelo"]> = { nfe: "55", nfce: "65", nfse: "nfse" };

/** Converte a entrada validada em NotaLida (o mesmo formato que o XML produz). */
export function notaDeEntrada(m: NotaManual, fonte: Exclude<FonteNota, "xml">): NotaLida {
  const info = m.chave ? infoDaChave(m.chave) : null;
  const itens = m.itens.map(
    (it, i): ItemLido => ({
      nItem: i + 1,
      codigo: it.codigo || String(i + 1),
      descricao: it.descricao,
      ncm: it.ncm,
      cfop: it.cfop,
      codigoServico: it.codigoServico || undefined,
      unidade: it.unidade || "UN",
      quantidade: it.quantidade,
      valorUnitario: it.valorUnitario,
      valor: Math.round(it.quantidade * it.valorUnitario * 100) / 100,
      desconto: it.desconto,
      frete: 0,
      seguro: 0,
      outros: 0,
      icms: it.icms,
      icmsCst: "",
      pis: it.pis,
      cofins: it.cofins,
      ipi: it.ipi,
      iss: it.iss,
    }),
  );
  const soma = (f: (i: ItemLido) => number) => Math.round(itens.reduce((s, i) => s + f(i), 0) * 100) / 100;
  const produtos = soma((i) => i.valor);
  const desconto = soma((i) => i.desconto);
  const ipi = soma((i) => i.ipi);

  return {
    fonte,
    chave: m.chave || "",
    modelo: MODELO[m.tipo],
    serie: m.serie || info?.serie || "",
    numero: m.numero || info?.numero || "",
    emissao: m.emissao || (info ? `${info.anoMes}-01` : ""),
    naturezaOperacao: m.naturezaOperacao || (m.tipo === "nfse" ? "Prestação de serviço" : "Venda de mercadoria"),
    autorizada: false,
    crt: m.regimeEmitente === "simples" ? "1" : "3",
    emitente: {
      documento: m.emitente.documento || info?.cnpjEmitente || "",
      nome: m.emitente.nome,
      uf: m.emitente.uf || info?.uf,
    },
    destinatario: m.destinatario && (m.destinatario.nome || m.destinatario.documento)
      ? { documento: m.destinatario.documento, nome: m.destinatario.nome, uf: m.destinatario.uf || undefined }
      : undefined,
    itens,
    totais: {
      produtos,
      desconto,
      icms: soma((i) => i.icms),
      pis: soma((i) => i.pis),
      cofins: soma((i) => i.cofins),
      ipi,
      nota: Math.round((produtos - desconto + ipi) * 100) / 100,
    },
  };
}

/** Caminho inverso: permite guardar uma NotaLida sem XML e reconverter depois. */
export function entradaDeNota(n: NotaLida): NotaManualEntrada {
  return {
    tipo: n.modelo === "nfse" ? "nfse" : n.modelo === "65" ? "nfce" : "nfe",
    chave: n.chave,
    numero: n.numero,
    serie: n.serie,
    emissao: n.emissao,
    naturezaOperacao: n.naturezaOperacao,
    regimeEmitente: ["1", "2", "4"].includes(n.crt) ? "simples" : "normal",
    emitente: { documento: n.emitente.documento, nome: n.emitente.nome, uf: n.emitente.uf ?? "" },
    destinatario: n.destinatario
      ? { documento: n.destinatario.documento, nome: n.destinatario.nome, uf: n.destinatario.uf ?? "" }
      : undefined,
    itens: n.itens.map((i) => ({
      descricao: i.descricao,
      codigo: i.codigo,
      ncm: i.ncm,
      cfop: i.cfop,
      codigoServico: i.codigoServico ?? "",
      unidade: i.unidade,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      desconto: i.desconto,
      icms: i.icms,
      pis: i.pis,
      cofins: i.cofins,
      ipi: i.ipi,
      iss: i.iss,
    })),
  };
}
