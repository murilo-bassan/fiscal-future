/**
 * Importação de notas por planilha (CSV): uma linha por item, várias notas no
 * mesmo arquivo, agrupadas pelo emitente e pelo número da nota. Aceita ";" ou
 * "," como separador e decimal com vírgula (Excel em português).
 * Sem dependências: roda no navegador e no servidor.
 */

import { dividirLinhaCsv, gerarCsv } from "./csv";
import { notaManualSchema, type NotaManualEntrada } from "./nfe/entrada";

export const COLUNAS_PLANILHA = [
  "tipo",
  "numero",
  "serie",
  "emissao",
  "chave",
  "regime_emitente",
  "emitente_documento",
  "emitente_nome",
  "emitente_uf",
  "destinatario_documento",
  "destinatario_nome",
  "descricao",
  "ncm",
  "cfop",
  "codigo_servico",
  "unidade",
  "quantidade",
  "valor_unitario",
  "desconto",
  "icms",
  "pis",
  "cofins",
  "ipi",
  "iss",
] as const;

type Coluna = (typeof COLUNAS_PLANILHA)[number];
const OBRIGATORIAS: Coluna[] = ["numero", "descricao", "valor_unitario"];

export const TAMANHO_MAXIMO_PLANILHA = 2 * 1024 * 1024;
export const MAX_LINHAS_PLANILHA = 5000;

export type ErroPlanilha = { linha: number; mensagem: string };
export type LeituraPlanilha = { notas: NotaManualEntrada[]; erros: ErroPlanilha[] };

/** CSV modelo para baixar: duas notas de exemplo (uma NF-e com 2 itens e uma NFS-e). */
export const CSV_MODELO = gerarCsv([
  [...COLUNAS_PLANILHA],
  ["nfe", "1234", "1", "15/10/2025", "", "normal", "12.345.678/0001-95", "Distribuidora Exemplo Ltda", "SP", "98.765.432/0001-98", "Mercado Cliente Ltda", "Arroz tipo 1 5kg", "1006.30.21", "5102", "", "FD", "10", "25,00", "0", "17,50", "1,63", "7,50", "0", "0"],
  ["nfe", "1234", "1", "15/10/2025", "", "normal", "12.345.678/0001-95", "Distribuidora Exemplo Ltda", "SP", "98.765.432/0001-98", "Mercado Cliente Ltda", "Camiseta de algodão", "6109.10.00", "5102", "", "UN", "20", "25,00", "0", "90,00", "3,25", "15,00", "0", "0"],
  ["nfse", "882", "", "10/09/2025", "", "simples", "11.222.333/0001-81", "Consultoria Exemplo ME", "SP", "98.765.432/0001-98", "Mercado Cliente Ltda", "Consultoria contábil mensal", "", "", "17.19", "UN", "1", "1.500,00", "0", "0", "0", "0", "0", "75,00"],
]);

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** "1.234,56" → 1234.56; "1234.56" → 1234.56; vazio → undefined; texto → NaN. */
export function numeroBr(s: string): number | undefined {
  let t = s.replace(/^'/, "").replace(/\s|R\$/g, "");
  if (t === "") return undefined;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Data em ISO (AAAA-MM-DD). Aceita DD/MM/AAAA. */
function dataIso(s: string): string | null {
  const t = s.trim();
  if (!t) return "";
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

const TIPOS: Record<string, NotaManualEntrada["tipo"]> = {
  nfe: "nfe", "nf-e": "nfe", "55": "nfe",
  nfce: "nfce", "nfc-e": "nfce", "65": "nfce",
  nfse: "nfse", "nfs-e": "nfse", servico: "nfse",
};

const REGIMES: Record<string, NotaManualEntrada["regimeEmitente"]> = {
  simples: "simples", "simples nacional": "simples", sn: "simples", mei: "simples", "1": "simples", "4": "simples",
  normal: "normal", "lucro presumido": "normal", "lucro real": "normal", presumido: "normal", real: "normal", "3": "normal",
};

const ROTULO_CAMPO: Record<string, string> = {
  tipo: "tipo",
  chave: "chave",
  numero: "numero",
  serie: "serie",
  emissao: "emissao",
  regimeEmitente: "regime_emitente",
  "emitente.documento": "emitente_documento",
  "emitente.nome": "emitente_nome",
  "emitente.uf": "emitente_uf",
  "destinatario.documento": "destinatario_documento",
  "destinatario.nome": "destinatario_nome",
  descricao: "descricao",
  ncm: "ncm",
  cfop: "cfop",
  codigoServico: "codigo_servico",
  unidade: "unidade",
  quantidade: "quantidade",
  valorUnitario: "valor_unitario",
  desconto: "desconto",
  icms: "icms",
  pis: "pis",
  cofins: "cofins",
  ipi: "ipi",
  iss: "iss",
};

type Linha = { n: number; v: (c: Coluna) => string };

export function lerPlanilhaNotas(texto: string): LeituraPlanilha {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const iCab = linhas.findIndex((l) => l.trim() !== "");
  if (iCab < 0) return { notas: [], erros: [{ linha: 1, mensagem: "A planilha está vazia." }] };

  const cab = linhas[iCab];
  const sep = [";", "\t", ","].find((s) => dividirLinhaCsv(cab, s).length > 1) ?? ";";
  const nomes = dividirLinhaCsv(cab, sep).map((c) => semAcento(c.replace(/^"|"$/g, "")).replace(/\s+/g, "_"));
  const indice = new Map<Coluna, number>();
  for (const c of COLUNAS_PLANILHA) {
    const i = nomes.indexOf(c);
    if (i >= 0) indice.set(c, i);
  }
  const faltando = OBRIGATORIAS.filter((c) => !indice.has(c));
  if (faltando.length) {
    return {
      notas: [],
      erros: [{ linha: iCab + 1, mensagem: `Faltam as colunas ${faltando.join(", ")}. Use o modelo da planilha.` }],
    };
  }

  const erros: ErroPlanilha[] = [];
  const grupos = new Map<string, Linha[]>();
  let dados = 0;
  for (let k = iCab + 1; k < linhas.length; k++) {
    if (!linhas[k].trim()) continue;
    const campos = dividirLinhaCsv(linhas[k], sep);
    if (campos.every((c) => c === "")) continue;
    if (++dados > MAX_LINHAS_PLANILHA) {
      erros.push({ linha: k + 1, mensagem: `A planilha passou de ${MAX_LINHAS_PLANILHA} linhas; o resto foi ignorado.` });
      break;
    }
    const linha: Linha = {
      n: k + 1,
      v: (c) => {
        const i = indice.get(c);
        return i === undefined ? "" : (campos[i] ?? "").replace(/^'(?=[=+\-@])/, "").trim();
      },
    };
    const numero = linha.v("numero");
    if (!numero) {
      erros.push({ linha: linha.n, mensagem: "Informe o número da nota na coluna numero." });
      continue;
    }
    const chave = `${linha.v("emitente_documento").replace(/\D/g, "")}|${numero}`;
    const g = grupos.get(chave);
    if (g) g.push(linha);
    else grupos.set(chave, [linha]);
  }

  const notas: NotaManualEntrada[] = [];
  for (const g of grupos.values()) {
    const r = montarNota(g);
    if ("erros" in r) erros.push(...r.erros);
    else notas.push(r.nota);
  }
  erros.sort((a, b) => a.linha - b.linha);
  if (dados === 0) erros.push({ linha: iCab + 2, mensagem: "A planilha não tem nenhuma linha de item." });
  return { notas, erros };
}

/** Uma nota a partir das linhas do grupo. O cabeçalho sai da primeira linha que tiver o campo preenchido. */
function montarNota(g: Linha[]): { nota: NotaManualEntrada } | { erros: ErroPlanilha[] } {
  const erros: ErroPlanilha[] = [];
  const primeiro = (c: Coluna) => {
    for (const l of g) {
      const v = l.v(c);
      if (v) return { v, n: l.n };
    }
    return { v: "", n: g[0].n };
  };

  const tipoTxt = primeiro("tipo");
  let tipo: NotaManualEntrada["tipo"];
  if (tipoTxt.v) {
    const t = TIPOS[semAcento(tipoTxt.v)];
    if (!t) erros.push({ linha: tipoTxt.n, mensagem: `tipo "${tipoTxt.v}" inválido: use nfe, nfce ou nfse.` });
    tipo = t ?? "nfe";
  } else {
    tipo = primeiro("codigo_servico").v ? "nfse" : "nfe";
  }

  const regimeTxt = primeiro("regime_emitente");
  const regime = regimeTxt.v ? REGIMES[semAcento(regimeTxt.v)] : "normal";
  if (!regime) erros.push({ linha: regimeTxt.n, mensagem: `regime_emitente "${regimeTxt.v}" inválido: use simples ou normal.` });

  const emissaoTxt = primeiro("emissao");
  const emissao = dataIso(emissaoTxt.v);
  if (emissao === null) erros.push({ linha: emissaoTxt.n, mensagem: `emissao "${emissaoTxt.v}" inválida: use DD/MM/AAAA.` });

  const numeroCampo = (l: Linha, c: Coluna) => {
    const v = numeroBr(l.v(c));
    if (v !== undefined && Number.isNaN(v)) {
      erros.push({ linha: l.n, mensagem: `${c} "${l.v(c)}" não é um número.` });
      return undefined;
    }
    return v;
  };

  const itens = g.map((l) => ({
    descricao: l.v("descricao"),
    ncm: l.v("ncm"),
    cfop: l.v("cfop"),
    codigoServico: l.v("codigo_servico"),
    unidade: l.v("unidade") || "UN",
    quantidade: numeroCampo(l, "quantidade") ?? 1,
    valorUnitario: numeroCampo(l, "valor_unitario") ?? (Number.NaN as number),
    desconto: numeroCampo(l, "desconto") ?? 0,
    icms: numeroCampo(l, "icms") ?? 0,
    pis: numeroCampo(l, "pis") ?? 0,
    cofins: numeroCampo(l, "cofins") ?? 0,
    ipi: numeroCampo(l, "ipi") ?? 0,
    iss: numeroCampo(l, "iss") ?? 0,
  }));
  itens.forEach((it, i) => {
    if (Number.isNaN(it.valorUnitario) && !erros.some((e) => e.linha === g[i].n)) {
      erros.push({ linha: g[i].n, mensagem: "Informe o valor_unitario do item." });
    }
  });

  const destDoc = primeiro("destinatario_documento").v;
  const destNome = primeiro("destinatario_nome").v;
  const nota: NotaManualEntrada = {
    tipo,
    chave: primeiro("chave").v,
    numero: g[0].v("numero"),
    serie: primeiro("serie").v,
    emissao: emissao ?? "",
    regimeEmitente: regime ?? "normal",
    emitente: {
      documento: g[0].v("emitente_documento"),
      nome: primeiro("emitente_nome").v,
      uf: primeiro("emitente_uf").v,
    },
    destinatario: destDoc || destNome ? { documento: destDoc, nome: destNome } : undefined,
    itens,
  };
  if (erros.length) return { erros };

  const ok = notaManualSchema.safeParse(nota);
  if (ok.success) return { nota };
  const vistos = new Set<string>();
  for (const issue of ok.error.issues) {
    const [p0, p1, p2] = issue.path;
    const ehItem = p0 === "itens" && typeof p1 === "number";
    const linha = ehItem ? (g[p1]?.n ?? g[0].n) : g[0].n;
    const campo = ehItem ? String(p2 ?? "") : issue.path.map(String).join(".");
    const rotulo = ROTULO_CAMPO[campo] ?? campo;
    const msg = rotulo ? `${rotulo}: ${issue.message}` : issue.message;
    const k = `${linha}|${msg}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    erros.push({ linha, mensagem: msg });
  }
  return { erros };
}
