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
export function nomeArquivo(chave: string, ano: number, ext: "xml" | "csv") {
  const c = chave.replace(/\D/g, "").slice(0, 44) || "nota";
  return ext === "xml" ? `${c}-ibscbs-${ano}.xml` : `${c}-ibscbs-${ano}.csv`;
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

const ROTULO_ORIGEM: Record<OrigemItem, string> = {
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
