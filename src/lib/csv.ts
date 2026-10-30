/**
 * Leitura e escrita de CSV simples para a classificação em lote.
 * Sem dependências: roda no navegador e no servidor.
 */

/** Divide uma linha de CSV respeitando aspas ("a;b" fica num campo só). */
export function dividirLinhaCsv(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (aspas) {
      if (ch === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (ch === '"') {
        aspas = false;
      } else {
        atual += ch;
      }
    } else if (ch === '"') {
      aspas = true;
    } else if (ch === sep) {
      campos.push(atual);
      atual = "";
    } else {
      atual += ch;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Extrai as descrições de um texto colado ou de um arquivo CSV.
 *
 * - Se a primeira linha tiver uma coluna "descricao" (ou "descrição"), lê só
 *   essa coluna, com separador ";" (Excel em português), "," ou tab.
 * - Senão, cada linha não vazia é uma descrição.
 *
 * Remove linhas vazias e repetidas (ignorando maiúsculas e acentos).
 */
export function lerDescricoes(texto: string): string[] {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const primeira = linhas.find((l) => l.trim() !== "") ?? "";

  let valores: string[];
  const sep = [";", "\t", ","].find((s) => dividirLinhaCsv(primeira, s).some((c) => ehColunaDescricao(c)));
  if (sep) {
    const cab = dividirLinhaCsv(primeira, sep);
    const col = cab.findIndex(ehColunaDescricao);
    const inicio = linhas.indexOf(primeira) + 1;
    valores = linhas.slice(inicio).map((l) => (l.trim() ? (dividirLinhaCsv(l, sep)[col] ?? "") : ""));
  } else {
    valores = linhas.map((l) => tirarAspas(l.trim()));
  }

  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const v of valores) {
    const limpo = v.replace(/\s+/g, " ").trim();
    if (!limpo) continue;
    const chave = semAcento(limpo);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(limpo);
  }
  return saida;
}

function ehColunaDescricao(c: string) {
  const n = semAcento(c.replace(/^"|"$/g, ""));
  return n === "descricao" || n === "descricoes";
}

function tirarAspas(s: string) {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/""/g, '"');
  return s;
}

/**
 * Gera CSV com ";" (abre direto no Excel em português) e BOM UTF-8.
 * Células que começam com = + - @ ganham um apóstrofo para o Excel não as
 * executar como fórmula (injeção de fórmula).
 */
export function gerarCsv(linhas: (string | number | null | undefined)[][]): string {
  const celula = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}
