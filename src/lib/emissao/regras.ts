/**
 * Regras da emissão que não dependem do banco: validação do rascunho,
 * justificativa de cancelamento, referência idempotente e limite do plano.
 * Isomórfico (pode rodar no formulário e no servidor).
 */

import { z } from "zod";
import { CATEGORIAS } from "../tax/categorias";
import type { RascunhoNota } from "./tipos";

const digitos = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : v);
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const opcional = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : texto(v));

function dvCpfOk(cpf: string) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(cpf[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

function dvCnpjOk(cnpj: string) {
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(cnpj[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

/** CPF (11) ou CNPJ (14) com dígitos verificadores corretos. */
export function documentoValido(doc: string) {
  if (doc.length === 11) return dvCpfOk(doc);
  if (doc.length === 14) return dvCnpjOk(doc);
  return false;
}

const IDS_CATEGORIA = new Set(CATEGORIAS.map((c) => c.id));

const numeroPositivo = (nome: string) =>
  z.number(`Informe ${nome}.`).finite(`Informe ${nome}.`).gt(0, `${nome[0].toUpperCase()}${nome.slice(1)} deve ser maior que zero.`);

const itemSchema = z.object({
  codigo: z.preprocess(texto, z.string().max(60, "Código do item com até 60 caracteres.")),
  descricao: z.preprocess(texto, z.string().min(1, "Descreva o item.").max(120, "Descrição com até 120 caracteres.")),
  ncm: z.preprocess((v) => opcional(digitos(v)), z.string().optional()),
  cfop: z.preprocess((v) => opcional(digitos(v)), z.string().optional()),
  codigoServico: z.preprocess((v) => opcional(digitos(v)), z.string().optional()),
  nbs: z.preprocess((v) => opcional(digitos(v)), z.string().optional()),
  unidade: z.preprocess(texto, z.string().min(1, "Informe a unidade (ex.: UN).").max(6, "Unidade com até 6 caracteres.")),
  quantidade: numeroPositivo("a quantidade"),
  valorUnitario: numeroPositivo("o valor unitário"),
  desconto: z.number("Desconto inválido.").finite("Desconto inválido.").min(0, "O desconto não pode ser negativo."),
  categoriaId: z.string().refine((id) => IDS_CATEGORIA.has(id), "Escolha a categoria do item."),
  aliquotaIcms: z.number().min(0, "Alíquota de ICMS entre 0% e 100%.").max(1, "Alíquota de ICMS entre 0% e 100%.").optional(),
});

const enderecoSchema = z
  .object({
    logradouro: z.preprocess(opcional, z.string().max(255).optional()),
    numero: z.preprocess(opcional, z.string().max(60).optional()),
    bairro: z.preprocess(opcional, z.string().max(60).optional()),
    cep: z.preprocess((v) => opcional(digitos(v)), z.string().regex(/^\d{8}$/, "CEP com 8 dígitos.").optional()),
    municipio: z.preprocess(opcional, z.string().max(60).optional()),
    codigoMunicipio: z.preprocess(
      (v) => opcional(digitos(v)),
      z.string().regex(/^\d{7}$/, "Código IBGE do município com 7 dígitos.").optional(),
    ),
    uf: z.preprocess(
      (v) => (typeof v === "string" ? opcional(v.toUpperCase()) : v),
      z.string().regex(/^[A-Z]{2}$/, "UF com 2 letras.").optional(),
    ),
  })
  .optional();

export const rascunhoSchema = z
  .object({
    tipo: z.enum(["nfe", "nfse"], "Escolha NF-e ou NFS-e."),
    naturezaOperacao: z.preprocess(
      texto,
      z.string().min(1, "Informe a natureza da operação.").max(60, "Natureza da operação com até 60 caracteres."),
    ),
    destinatario: z.object({
      documento: z.preprocess(
        digitos,
        z
          .string()
          .regex(/^(\d{11}|\d{14})$/, "CPF (11 dígitos) ou CNPJ (14 dígitos).")
          .refine(documentoValido, "CPF ou CNPJ com dígito verificador errado. Confira o número."),
      ),
      nome: z.preprocess(texto, z.string().min(2, "Informe o nome do cliente.").max(150, "Nome com até 150 caracteres.")),
      email: z.preprocess(opcional, z.email("E-mail inválido.").optional()),
      inscricaoEstadual: z.preprocess(opcional, z.string().max(14, "IE com até 14 caracteres.").optional()),
      endereco: enderecoSchema,
      consumidorFinal: z.boolean(),
    }),
    itens: z.array(itemSchema).min(1, "Inclua pelo menos um item.").max(100, "No máximo 100 itens por nota."),
    informacoesAdicionais: z.preprocess(opcional, z.string().max(2000, "Informações adicionais com até 2.000 caracteres.").optional()),
    origemChave: z.preprocess(opcional, z.string().regex(/^\d{44}$/).optional()),
  })
  .superRefine((r, ctx) => {
    r.itens.forEach((it, i) => {
      const caminho = (campo: string) => ["itens", i, campo];
      if (it.desconto > it.quantidade * it.valorUnitario) {
        ctx.addIssue({ code: "custom", path: caminho("desconto"), message: "O desconto é maior que o valor do item." });
      }
      if (r.tipo === "nfe") {
        if (!it.ncm || !/^\d{8}$/.test(it.ncm))
          ctx.addIssue({ code: "custom", path: caminho("ncm"), message: "NCM com 8 dígitos." });
        if (!it.cfop || !/^\d{4}$/.test(it.cfop))
          ctx.addIssue({ code: "custom", path: caminho("cfop"), message: "CFOP com 4 dígitos." });
      } else {
        if (!it.codigoServico || !/^\d{6}$/.test(it.codigoServico))
          ctx.addIssue({
            code: "custom",
            path: caminho("codigoServico"),
            message: "Código do serviço (tributação nacional) com 6 dígitos.",
          });
        if (it.nbs && !/^\d{9}$/.test(it.nbs))
          ctx.addIssue({ code: "custom", path: caminho("nbs"), message: "Código NBS com 9 dígitos." });
      }
    });
    // A DPS da NFS-e nacional descreve um único serviço
    if (r.tipo === "nfse" && r.itens.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["itens"],
        message: "A NFS-e nacional tem um serviço por nota. Junte a descrição num item só ou emita mais de uma nota.",
      });
    }
  });

export type ErrosRascunho = Record<string, string>;

/** Caminho do zod ("itens.0.ncm") vira chave de campo no formulário. */
export function validarRascunho(
  dados: unknown,
): { ok: true; rascunho: RascunhoNota } | { ok: false; erros: ErrosRascunho; mensagens: string[] } {
  const r = rascunhoSchema.safeParse(dados);
  if (r.success) {
    const rascunho = r.data as RascunhoNota;
    rascunho.itens = rascunho.itens.map((it, i) => ({ ...it, codigo: it.codigo || String(i + 1) }));
    return { ok: true, rascunho };
  }
  const erros: ErrosRascunho = {};
  const mensagens: string[] = [];
  for (const issue of r.error.issues) {
    const chave = issue.path.join(".");
    if (erros[chave]) continue;
    erros[chave] = issue.message;
    const item = issue.path[0] === "itens" && typeof issue.path[1] === "number" ? `Item ${issue.path[1] + 1}: ` : "";
    mensagens.push(item + issue.message);
  }
  return { ok: false, erros, mensagens };
}

export function validarJustificativa(texto: string): { ok: true; justificativa: string } | { ok: false; erro: string } {
  const j = texto.trim().replace(/\s+/g, " ");
  if (j.length < 15) return { ok: false, erro: "Escreva o motivo do cancelamento com pelo menos 15 caracteres." };
  if (j.length > 255) return { ok: false, erro: "O motivo do cancelamento pode ter no máximo 255 caracteres." };
  return { ok: true, justificativa: j };
}

/** Referência única e estável da nota no provedor (idempotência). */
export function gerarRef(id: string): string {
  return `za-${id}`;
}

export function inicioDoMes(agora = new Date()) {
  return new Date(agora.getFullYear(), agora.getMonth(), 1);
}

export function checarLimite(usadas: number, limite: number): { ok: true } | { ok: false; erro: string; upgrade: true } {
  if (limite <= 0) {
    return { ok: false, upgrade: true, erro: "A emissão de notas está nos planos pagos. Escolha um plano em Conta para emitir." };
  }
  if (usadas >= limite) {
    return {
      ok: false,
      upgrade: true,
      erro: `Você já emitiu ${usadas} de ${limite} notas este mês. Mude de plano em Conta para emitir mais.`,
    };
  }
  return { ok: true };
}

/** Status que contam no limite do mês: tudo menos "erro" (falha antes de chegar à SEFAZ/prefeitura). */
export const STATUS_QUE_CONTAM = ["processando", "autorizada", "rejeitada", "cancelada"] as const;
