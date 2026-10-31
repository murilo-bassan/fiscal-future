/**
 * Tipos e lógica pura do conversor de notas antigas (sem dependências de
 * servidor): validação de entrada, ajuste das escolhas da IA e do usuário sobre
 * o resultado do conversor, leitura do JSON salvo e montagem do CSV.
 * Usado pelas rotas /api/converter e pelos componentes do cliente.
 */

import { z } from "zod";
import type { Confianca } from "../../lib/classificador";
import type { ItemConvertido, NotaConvertida, OrigemClassificacao } from "../../lib/nfe/conversor";
import { CATEGORIAS } from "../../lib/tax/categorias";
import { PRESETS, REDUCOES } from "../../lib/tax/params";
import { gerarCsv } from "../../lib/csv";
import type { FonteNota } from "../../lib/nfe/parser";
import type { NotaManualEntrada } from "../../lib/nfe/entrada";

/* ------------------------------------------------------------- anos ---- */

export const ANOS_CONVERSAO = [2026, 2027, 2033] as const;
export type AnoConversao = (typeof ANOS_CONVERSAO)[number];

export const EXPLICACAO_ANO: Record<AnoConversao, { titulo: string; texto: string }> = {
  2026: {
    titulo: "Ano de teste",
    texto: "IBS e CBS aparecem na nota, mas são compensados com PIS/Cofins. Não mudam o valor a pagar.",
  },
  2027: {
    titulo: "CBS cheia",
    texto: "PIS e Cofins acabam, o IPI zera e a CBS passa a ser cobrada inteira. ICMS e ISS continuam.",
  },
  2033: {
    titulo: "Modelo completo",
    texto: "ICMS e ISS deixam de existir. Só IBS e CBS, com as alíquotas cheias.",
  },
};

/* ---------------------------------------------------------- entrada ---- */

export const MAX_ARQUIVOS = 50;
export const TAMANHO_MAXIMO_ARQUIVO = 2 * 1024 * 1024;

const IDS_CATEGORIA = CATEGORIAS.map((c) => c.id) as [string, ...string[]];
const IDS_CENARIO = PRESETS.map((p) => p.id) as [string, ...string[]];

const anoSchema = z.coerce
  .number({ error: "Escolha o ano: 2026, 2027 ou 2033." })
  .refine((n): n is AnoConversao => (ANOS_CONVERSAO as readonly number[]).includes(n), {
    message: "Escolha o ano: 2026, 2027 ou 2033.",
  });

const cenarioSchema = z.enum(IDS_CENARIO, { error: "Cenário de alíquota inválido." });
const idSchema = z.string().trim().min(1).max(64);

/** Campos do envio (multipart) além dos arquivos. */
export const envioSchema = z.object({
  ano: anoSchema,
  cenarioId: cenarioSchema.optional(),
  empresaId: idSchema.optional(),
});

/** Corpo do PATCH /api/converter/[id]. */
export const ajusteSchema = z
  .object({
    classificacoes: z
      .record(z.string().regex(/^\d{1,4}$/, "Item inválido."), z.enum(IDS_CATEGORIA, { error: "Categoria inválida." }))
      .refine((r) => Object.keys(r).length <= 990, "Itens demais.")
      .optional(),
    ano: anoSchema.optional(),
    cenarioId: cenarioSchema.optional(),
    empresaId: idSchema.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nada para alterar.");

export type Ajuste = z.infer<typeof ajusteSchema>;

/** Máximo de notas digitadas (JSON) ou de uma planilha num envio. */
export const MAX_NOTAS_ENVIO = MAX_ARQUIVOS;

/**
 * Corpo JSON do POST para notas digitadas. As notas são validadas uma a uma
 * depois (notaManualSchema), para um erro não derrubar o lote.
 */
export const envioManualSchema = envioSchema.extend({
  fonte: z.literal("manual", { error: "Fonte inválida." }),
  nota: z.union([z.array(z.unknown()).min(1, "Inclua pelo menos uma nota.").max(MAX_NOTAS_ENVIO, `Envie no máximo ${MAX_NOTAS_ENVIO} notas por vez.`), z.record(z.string(), z.unknown())]),
});

/** De onde veio cada conversão, para o histórico e o selo do resultado. */
export const ROTULO_FONTE: Record<FonteNota, string> = {
  xml: "XML",
  documento: "PDF ou foto",
  manual: "Digitada",
  planilha: "Planilha",
};

/** Confere nome e tamanho de um arquivo enviado. Devolve a mensagem de erro, ou null. */
export function validarArquivo(f: { name: string; size: number; type?: string }): string | null {
  if (!/\.xml$/i.test(f.name)) return "Envie arquivos .xml de NF-e ou NFC-e.";
  if (f.type && !/^(text|application)\/xml$/i.test(f.type) && f.type !== "application/octet-stream") {
    return "O arquivo não é um XML.";
  }
  if (f.size === 0) return "O arquivo está vazio.";
  if (f.size > TAMANHO_MAXIMO_ARQUIVO) return "Arquivo grande demais (máx. 2 MB).";
  return null;
}

/** Nome do download do XML convertido: só dígitos da chave, para não montar caminho nem cabeçalho estranho. */
export function nomeArquivo(chave: string, ano: number, ext: "xml" | "csv" | "pdf") {
  const c = chave.replace(/\D/g, "").slice(0, 44) || "nota";
  return `${c}-ibscbs-${ano}.${ext}`;
}

/* ------------------------------------------------- resultado salvo ---- */

export type OrigemItem = OrigemClassificacao | "ia";

/** Escolha de categoria feita pela IA ou pelo usuário, guardada para reconverter. */
export type Escolha = {
  categoriaId: string;
  origem: "ia" | "usuario";
  confianca?: Confianca;
  /** O que conferir, quando veio da IA. */
  conferir?: string;
};

export type ItemSalvo = Omit<ItemConvertido, "origem"> & {
  origem: OrigemItem;
  /** Orientação da IA sobre o que conferir neste item. */
  dica?: string;
};

/** O que fica no campo `resultado` de ConversaoNota: NotaConvertida sem o xml, mais as escolhas. */
export type ResultadoSalvo = Omit<NotaConvertida, "xml" | "itens"> & {
  itens: ItemSalvo[];
  escolhas: Record<string, Escolha>;
};

export type ConversaoView = {
  id: string;
  empresaId: string | null;
  createdAt: string;
  exemplo: boolean;
  fonte: FonteNota;
  /** Dados da nota sem XML, para o formulário de correção. Null quando veio de XML. */
  entrada: NotaManualEntrada | null;
  resultado: ResultadoSalvo;
};

export type ResumoConversao = {
  id: string;
  numero: string;
  emitente: string;
  ano: number;
  createdAt: string;
  variacao: number | null;
  exemplo: boolean;
  fonte: FonteNota;
};

const AVISO_CONFERIR = /de conferência da classificação/;

/**
 * Aplica as escolhas ao resultado do conversor. O conversor marca tudo que veio
 * em `classificacoes` como "usuario" e sem conferência; aqui as escolhas da IA
 * voltam a ser "ia" e só dispensam conferência com confiança alta. O aviso de
 * itens a conferir é refeito com a contagem certa.
 */
export function aplicarEscolhas(conv: NotaConvertida, escolhas: Record<string, Escolha>): ResultadoSalvo {
  const itens: ItemSalvo[] = conv.itens.map((it) => {
    const e = escolhas[String(it.nItem)];
    if (e?.origem === "ia" && it.origem === "usuario" && it.categoria.id === e.categoriaId) {
      return { ...it, origem: "ia", conferir: e.confianca !== "alta", dica: e.conferir };
    }
    return it;
  });

  const aConferir = itens.filter((i) => i.conferir).length;
  const avisos = conv.avisos.filter((a) => !AVISO_CONFERIR.test(a));
  if (aConferir) {
    avisos.push(
      `${aConferir} ${aConferir === 1 ? "item precisa" : "itens precisam"} de conferência da classificação (confirme se o NCM está no anexo da LC 214/2025).`,
    );
  }

  const { xml: _xml, itens: _itens, ...resto } = conv;
  void _xml;
  void _itens;
  return { ...resto, itens, avisos, escolhas };
}

/** Escolhas → mapa nItem → categoria, no formato que o conversor recebe. */
export function classificacoesDe(escolhas: Record<string, Escolha>): Record<number, string> {
  const r: Record<number, string> = {};
  for (const [n, e] of Object.entries(escolhas)) r[Number(n)] = e.categoriaId;
  return r;
}

/** Junta as escolhas novas do usuário às que já existiam. */
export function mesclarEscolhas(
  atuais: Record<string, Escolha>,
  doUsuario: Record<string, string> | undefined,
  itensValidos: number[],
): Record<string, Escolha> {
  const r = { ...atuais };
  const validos = new Set(itensValidos.map(String));
  for (const [n, categoriaId] of Object.entries(doUsuario ?? {})) {
    if (validos.has(n)) r[n] = { categoriaId, origem: "usuario" };
  }
  return r;
}

const descricaoNormal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Depois de corrigir os dados de uma nota (PUT), mantém a escolha de cada item
 * só se o item com aquele número continua sendo o mesmo (mesma descrição).
 * Itens novos ou trocados voltam a ser classificados pelo conversor.
 */
export function escolhasMantidas(
  escolhas: Record<string, Escolha>,
  itensAntes: { nItem: number; descricao: string }[],
  itensDepois: { nItem: number; descricao: string }[],
): Record<string, Escolha> {
  const antes = new Map(itensAntes.map((i) => [String(i.nItem), descricaoNormal(i.descricao)]));
  const r: Record<string, Escolha> = {};
  for (const it of itensDepois) {
    const n = String(it.nItem);
    if (escolhas[n] && antes.get(n) === descricaoNormal(it.descricao)) r[n] = escolhas[n];
  }
  return r;
}

/** Lê o JSON do banco. Devolve null se estiver corrompido. */
export function lerResultadoSalvo(json: string): ResultadoSalvo | null {
  try {
    const r = JSON.parse(json) as Partial<ResultadoSalvo>;
    if (!r || !Array.isArray(r.itens) || !r.totais || !r.nota || typeof r.ano !== "number" || !r.cenario) return null;
    return { ...r, escolhas: r.escolhas ?? {}, avisos: r.avisos ?? [] } as ResultadoSalvo;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- CSV ---- */

const dec = (v: number) => v.toFixed(2).replace(".", ",");

export const ROTULO_ORIGEM: Record<OrigemItem, string> = {
  usuario: "escolha do usuário",
  nota: "já estava na nota",
  "palavras-chave": "palavras-chave",
  padrao: "padrão",
  ia: "IA",
};

export const CABECALHO_CSV = [
  "nota",
  "item",
  "descricao",
  "ncm",
  "cfop",
  "valor",
  "categoria",
  "cst",
  "cclasstrib",
  "reducao",
  "tributos_antigos",
  "base_ibs_cbs",
  "cbs",
  "ibs_uf",
  "ibs_mun",
  `total_no_ano`,
  "conferir",
  "origem",
];

/** CSV com uma linha por item, separador ";" e decimais com vírgula (Excel em português). */
export function montarCsv(r: Pick<ResultadoSalvo, "nota" | "itens">): string {
  return gerarCsv([
    CABECALHO_CSV,
    ...r.itens.map((i) => [
      r.nota.numero,
      i.nItem,
      i.descricao,
      i.ncm,
      i.cfop,
      dec(i.valor),
      i.categoria.nome,
      i.ibsCbs.cst,
      i.ibsCbs.cClassTrib,
      `${Math.round(REDUCOES[i.categoria.reducao].reducao * 100)}%`,
      dec(i.tributosOriginais.total),
      dec(i.ibsCbs.base),
      dec(i.ibsCbs.cbs.valor),
      dec(i.ibsCbs.ibsUf.valor),
      dec(i.ibsCbs.ibsMun.valor),
      dec(i.totalNoAno),
      i.conferir ? "sim" : "não",
      ROTULO_ORIGEM[i.origem] ?? i.origem,
    ]),
  ]);
}

/* -------------------------------------------------------- conferência ---- */

export type Conferencia = { ok: boolean; pendencias: string[] };

const centavos = (vs: number[]) => Math.round(vs.reduce((s, v) => s + v, 0) * 100);

/**
 * Confere a nota convertida antes de usar o resultado: formato dos códigos do
 * IBS/CBS, NCM, soma dos itens contra os totais e itens com classificação a conferir.
 * Não substitui a SEFAZ: só ela autoriza uma nota.
 */
export function conferirConversao(r: Pick<ResultadoSalvo, "nota" | "itens" | "totais">): Conferencia {
  const pendencias: string[] = [];
  const servico = r.nota.modelo === "nfse";
  for (const i of r.itens) {
    const rotulo = `Item ${i.nItem} (${i.descricao.slice(0, 40)})`;
    if (!/^\d{3}$/.test(i.ibsCbs.cst)) pendencias.push(`${rotulo}: CST do IBS/CBS fora do formato (3 dígitos).`);
    if (!/^\d{6}$/.test(i.ibsCbs.cClassTrib)) pendencias.push(`${rotulo}: cClassTrib fora do formato (6 dígitos).`);
    if (!servico && !/^\d{8}$/.test(i.ncm)) pendencias.push(`${rotulo}: NCM precisa de 8 dígitos.`);
    if (i.conferir) pendencias.push(`${rotulo}: confirme a classificação "${i.categoria.nome}".`);
  }
  if (Math.abs(centavos(r.itens.map((i) => i.ibsCbs.total)) - Math.round(r.totais.ibsCbs * 100)) > 2) {
    pendencias.push("A soma do IBS/CBS dos itens não bate com o total da nota.");
  }
  if (Math.abs(centavos(r.itens.map((i) => i.ibsCbs.base)) - Math.round(r.totais.base * 100)) > 2) {
    pendencias.push("A soma das bases de cálculo dos itens não bate com a base total.");
  }
  return { ok: pendencias.length === 0, pendencias };
}
