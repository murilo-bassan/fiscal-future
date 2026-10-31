/**
 * PDF da nota convertida: dados da nota original, itens com a classificação e o
 * IBS/CBS do ano escolhido, totais, conferência e avisos. É um relatório de
 * referência com tarja de "sem valor fiscal", não um DANFE.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { REDUCOES } from "@/lib/tax/params";
import { ROTULO_ORIGEM, conferirConversao, type ResultadoSalvo } from "@/components/conversor/modelo";

const A4_PAISAGEM: [number, number] = [841.89, 595.28];
const MARGEM = 36;
const COR_TEXTO = rgb(0.11, 0.13, 0.16);
const COR_SUAVE = rgb(0.42, 0.45, 0.5);
const COR_LINHA = rgb(0.85, 0.86, 0.88);
const COR_FUNDO = rgb(0.95, 0.96, 0.97);
const COR_ALERTA = rgb(0.7, 0.33, 0.05);
const COR_OK = rgb(0.09, 0.47, 0.29);

// Caracteres do WinAnsi acima do Latin-1 (as fontes padrão do PDF só desenham esse conjunto)
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Troca o que a fonte padrão não desenha: tira o acento de letra rara e usa "?" no resto. */
export function textoSeguro(s: string): string {
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRA.has(ch)) {
      out += ch;
    } else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base && [...base].every((c) => c.charCodeAt(0) <= 0xff) ? base : "?";
    }
  }
  return out;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const documento = (d: string) =>
  d.length === 14
    ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : d.length === 11
      ? d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
      : d;
const participante = (p?: { nome: string; documento: string }) =>
  p ? [p.nome, p.documento && documento(p.documento)].filter(Boolean).join(" · ") : "";
const chaveFormatada = (c: string) => c.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
const MODELO: Record<string, string> = { "55": "NF-e", "65": "NFC-e", nfse: "NFS-e" };

type Coluna = { titulo: string; largura: number; alinhar?: "dir" };
type OpcoesTexto = { tam?: number; f?: PDFFont; cor?: RGB; max?: number; alinhar?: "dir" };

/** Escreve de cima para baixo, abrindo página nova quando falta espaço. */
class Escritor {
  page!: PDFPage;
  y = 0;
  readonly largura = A4_PAISAGEM[0] - 2 * MARGEM;

  constructor(
    readonly pdf: PDFDocument,
    readonly fonte: PDFFont,
    readonly negrito: PDFFont,
  ) {
    this.novaPagina();
  }

  novaPagina() {
    this.page = this.pdf.addPage(A4_PAISAGEM);
    this.y = A4_PAISAGEM[1] - MARGEM;
  }

  /** Garante `altura` livre (o rodapé fica de fora). Devolve true se abriu página. */
  espaco(altura: number) {
    if (this.y - altura >= MARGEM + 12) return false;
    this.novaPagina();
    return true;
  }

  /** Corta com "…" para caber em `max` pontos. */
  caber(s: string, max: number, tam: number, f = this.fonte) {
    let t = textoSeguro(s);
    if (f.widthOfTextAtSize(t, tam) <= max) return t;
    while (t.length > 1 && f.widthOfTextAtSize(`${t}…`, tam) > max) t = t.slice(0, -1);
    return `${t}…`;
  }

  /** Quebra em linhas de até `max` pontos. */
  quebrar(s: string, max: number, tam: number, f = this.fonte) {
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of textoSeguro(s).split(" ")) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (!atual || f.widthOfTextAtSize(tentativa, tam) <= max) {
        atual = tentativa;
      } else {
        linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
    return linhas.map((l) => this.caber(l, max, tam, f));
  }

  texto(s: string, x: number, y: number, o: OpcoesTexto = {}) {
    const tam = o.tam ?? 9;
    const f = o.f ?? this.fonte;
    const t = o.max ? this.caber(s, o.max, tam, f) : textoSeguro(s);
    const dx = o.alinhar === "dir" && o.max ? o.max - f.widthOfTextAtSize(t, tam) : 0;
    this.page.drawText(t, { x: x + dx, y, size: tam, font: f, color: o.cor ?? COR_TEXTO });
  }

  linha(y = this.y) {
    this.page.drawLine({ start: { x: MARGEM, y }, end: { x: MARGEM + this.largura, y }, thickness: 0.5, color: COR_LINHA });
  }

  titulo(s: string) {
    this.espaco(48);
    this.y -= 22;
    this.texto(s, MARGEM, this.y, { tam: 11, f: this.negrito });
    this.y -= 6;
    this.linha();
  }

  /** Pares rótulo/valor em colunas. */
  campos(pares: [string, string][], colunas = 3) {
    const larg = this.largura / colunas;
    for (let i = 0; i < pares.length; i += colunas) {
      this.espaco(28);
      this.y -= 13;
      pares.slice(i, i + colunas).forEach(([rotulo, valor], j) => {
        const x = MARGEM + j * larg;
        this.texto(rotulo, x, this.y, { tam: 7, cor: COR_SUAVE, max: larg - 8 });
        this.texto(valor || "—", x, this.y - 11, { tam: 9, max: larg - 8 });
      });
      this.y -= 13;
    }
  }

  private cabecalhoTabela(cols: Coluna[]) {
    this.page.drawRectangle({ x: MARGEM, y: this.y - 16, width: this.largura, height: 16, color: COR_FUNDO });
    let x = MARGEM + 4;
    for (const c of cols) {
      this.texto(c.titulo, x, this.y - 11, { tam: 7, f: this.negrito, cor: COR_SUAVE, max: c.largura - 8, alinhar: c.alinhar });
      x += c.largura;
    }
    this.y -= 16;
  }

  tabela(cols: Coluna[], linhas: string[][]) {
    this.espaco(40);
    this.y -= 6;
    this.cabecalhoTabela(cols);
    for (const l of linhas) {
      if (this.espaco(16)) this.cabecalhoTabela(cols);
      let x = MARGEM + 4;
      l.forEach((v, j) => {
        this.texto(v, x, this.y - 11, { tam: 8, max: cols[j].largura - 8, alinhar: cols[j].alinhar });
        x += cols[j].largura;
      });
      this.y -= 15;
      this.linha();
    }
  }

  /** Lista com marcador, quebrando linhas longas. */
  lista(itens: string[], cor = COR_TEXTO) {
    for (const item of itens) {
      const linhas = this.quebrar(item, this.largura - 14, 8.5);
      this.espaco(linhas.length * 11 + 4);
      this.y -= 12;
      this.texto("•", MARGEM, this.y, { tam: 8.5, cor });
      linhas.forEach((l, k) => this.texto(l, MARGEM + 10, this.y - k * 11, { tam: 8.5, cor }));
      this.y -= (linhas.length - 1) * 11;
    }
  }
}

export async function gerarPdfConversao(r: ResultadoSalvo, geradoEm = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const n = r.nota;
  const tipo = MODELO[n.modelo] ?? "Nota";
  pdf.setTitle(textoSeguro(`${tipo} ${n.numero} convertida para IBS/CBS (${r.ano})`));
  pdf.setAuthor("Fiscal Future");
  pdf.setCreator("Fiscal Future");
  pdf.setProducer("Fiscal Future");
  pdf.setCreationDate(geradoEm);
  pdf.setModificationDate(geradoEm);

  const w = new Escritor(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold));
  const conf = conferirConversao(r);

  // Cabeçalho e tarja
  w.texto("Fiscal Future", MARGEM, w.y - 10, { tam: 9, f: w.negrito, cor: COR_SUAVE });
  w.texto(`${tipo} nº ${n.numero || "s/n"} no modelo da reforma (${r.ano})`, MARGEM, w.y - 30, { tam: 16, f: w.negrito, max: w.largura });
  w.texto(
    `Cenário: ${r.cenario.nome} · CBS ${pct(r.cenario.cbs)} · IBS ${pct(r.cenario.ibs)} (alíquotas de referência)`,
    MARGEM,
    w.y - 45,
    { tam: 8.5, cor: COR_SUAVE, max: w.largura },
  );
  w.y -= 58;
  w.page.drawRectangle({ x: MARGEM, y: w.y - 18, width: w.largura, height: 18, color: rgb(1, 0.95, 0.86) });
  w.texto("SIMULAÇÃO PARA REFERÊNCIA · SEM VALOR FISCAL", MARGEM + 8, w.y - 12.5, { tam: 8.5, f: w.negrito, cor: COR_ALERTA });
  w.y -= 18;

  w.titulo("Nota original");
  w.campos([
    ["Emitente", participante(n.emitente)],
    ["Destinatário", participante(n.destinatario)],
    ["Emissão", n.emissao ? new Date(n.emissao).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""],
    ["Série / número", `${n.serie || "—"} / ${n.numero || "—"}`],
    ["Natureza da operação", n.naturezaOperacao],
    ["Situação", n.autorizada ? `Autorizada${n.protocolo ? ` · protocolo ${n.protocolo}` : ""}` : "Sem protocolo de autorização"],
  ]);
  if (n.chave) w.campos([["Chave de acesso", chaveFormatada(n.chave)]], 1);

  w.titulo("Itens no modelo novo");
  const cols: Coluna[] = [
    { titulo: "#", largura: 22 },
    { titulo: "Descrição", largura: 142 },
    { titulo: n.modelo === "nfse" ? "Serviço" : "NCM", largura: 54 },
    { titulo: "Classificação", largura: 124 },
    { titulo: "CST / cClassTrib", largura: 72 },
    { titulo: "Redução", largura: 42, alinhar: "dir" },
    { titulo: "Valor", largura: 64, alinhar: "dir" },
    { titulo: "Trib. antigos", largura: 62, alinhar: "dir" },
    { titulo: "CBS", largura: 56, alinhar: "dir" },
    { titulo: "IBS", largura: 56, alinhar: "dir" },
    { titulo: `Total ${r.ano}`, largura: 0, alinhar: "dir" },
  ];
  cols[cols.length - 1].largura = w.largura - cols.reduce((s, c) => s + c.largura, 0);
  w.tabela(
    cols,
    r.itens.map((i) => [
      String(i.nItem),
      i.descricao,
      i.ncm || "—",
      `${i.categoria.nome} · ${ROTULO_ORIGEM[i.origem] ?? i.origem}`,
      `${i.ibsCbs.cst} / ${i.ibsCbs.cClassTrib}`,
      `${Math.round(REDUCOES[i.categoria.reducao].reducao * 100)}%`,
      moeda(i.valor),
      moeda(i.tributosOriginais.total),
      moeda(i.ibsCbs.cbs.valor),
      moeda(i.ibsCbs.vIBS),
      moeda(i.totalNoAno),
    ]),
  );

  const t = r.totais;
  w.titulo("Totais");
  w.campos(
    [
      ["Base do IBS/CBS", moeda(t.base)],
      ["CBS", moeda(t.cbs)],
      ["IBS estadual", moeda(t.ibsUf)],
      ["IBS municipal", moeda(t.ibsMun)],
      ["IBS + CBS", moeda(t.ibsCbs)],
      ["Valor da nota", moeda(n.totais.nota)],
      ["Tributos na nota original", moeda(t.tributosOriginais)],
      [`Tributos sobre consumo em ${r.ano}`, moeda(t.totalNoAno)],
      ["Variação", `${t.variacao >= 0 ? "+" : ""}${pct(t.variacao)}`],
    ],
    5,
  );

  w.titulo("Conferência");
  w.espaco(20);
  w.y -= 14;
  const resumo = conf.ok
    ? "Sem pendências: códigos do IBS/CBS no formato, NCM válido e totais batendo com os itens."
    : `${conf.pendencias.length} ${conf.pendencias.length === 1 ? "pendência" : "pendências"} antes de usar estes valores:`;
  w.texto(resumo, MARGEM, w.y, { tam: 9, f: w.negrito, cor: conf.ok ? COR_OK : COR_ALERTA, max: w.largura });
  if (!conf.ok) w.lista(conf.pendencias, COR_ALERTA);

  if (r.avisos.length) {
    w.titulo("Avisos");
    w.lista(r.avisos);
  }

  // Rodapé em todas as páginas
  const paginas = pdf.getPages();
  const data = geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  paginas.forEach((p, k) => {
    w.page = p;
    w.texto(
      `Gerado em ${data}. Estimativa para planejamento. Uma nota autorizada não pode ser alterada: para valer, emita uma nota nova.`,
      MARGEM,
      MARGEM - 14,
      { tam: 7, cor: COR_SUAVE, max: w.largura - 70 },
    );
    w.texto(`Página ${k + 1} de ${paginas.length}`, MARGEM, MARGEM - 14, { tam: 7, cor: COR_SUAVE, max: w.largura, alinhar: "dir" });
  });

  return pdf.save();
}
