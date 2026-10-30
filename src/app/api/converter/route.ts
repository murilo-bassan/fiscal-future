import { NextResponse } from "next/server";
import { consumir, mensagemLimite } from "@/lib/limite";
import { db } from "@/lib/db";
import { plano, type Plano } from "@/lib/planos";
import { classificar, iaDisponivel } from "@/lib/classificador";
import { classificacoesNoMes } from "@/lib/uso";
import { ErroLeituraNota, lerNota, notaDeEntrada, notaManualSchema, type NotaLida } from "@/lib/nfe";
import { ErroExtracao, TAMANHO_MAXIMO_PDF, extracaoDisponivel, extrairNotaDeDocumento } from "@/lib/extracao";
import { TAMANHO_MAXIMO_PLANILHA, lerPlanilhaNotas } from "@/lib/planilhaNotas";
import type { CenarioAliquota } from "@/lib/tax/params";
import {
  MAX_ARQUIVOS,
  MAX_NOTAS_ENVIO,
  TAMANHO_MAXIMO_ARQUIVO,
  envioManualSchema,
  envioSchema,
  validarArquivo,
  type ConversaoView,
  type Escolha,
} from "@/components/conversor/modelo";
import { XML_EXEMPLO } from "./_lib/exemplo";
import { cenarioPorId, conteudoOriginal, conversoesNoMes, converter, exigirSessao, paraView } from "./_lib/servico";

export const runtime = "nodejs";
// Com IA, um lote de 50 notas pode levar alguns minutos.
export const maxDuration = 300;

type Usuario = NonNullable<Awaited<ReturnType<typeof exigirSessao>>["u"]>;
type Contexto = {
  u: Usuario;
  p: Plano;
  ano: number;
  cenario: CenarioAliquota;
  empresaId?: string;
  exemplo: boolean;
};
/** Nota já lida, pronta para converter. `xml` só existe na fonte "xml". */
type Lido = { ordem: number; arquivo: string; nota: NotaLida; xml?: string };
type Saida = { arquivo: string; conversao: ConversaoView } | { arquivo: string; erro: string };
type SaidaOrdenada = Saida & { ordem: number };

const chaveDescricao = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300);
const erro = (msg: string, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ erro: msg, ...extra }, { status });

/**
 * POST multipart:
 *  - fonte=xml (padrão): arquivos (um ou mais .xml). Ou `exemplo=1` sem arquivos (não conta no limite).
 *  - fonte=documento: arquivo (PDF, JPEG, PNG ou WEBP). A IA extrai os dados.
 *  - fonte=planilha: arquivo (.csv, uma linha por item).
 *  Mais: ano, cenarioId?, empresaId?.
 * POST JSON: { fonte: "manual", nota: NotaManualEntrada | NotaManualEntrada[], ano, cenarioId?, empresaId? }.
 */
export async function POST(req: Request) {
  const { u, erro: semSessao } = await exigirSessao();
  if (!u) return semSessao;
  const limite = await consumir("ia", u.id);
  if (!limite.ok) return erro(mensagemLimite(limite), 429);

  const tipo = req.headers.get("content-type") ?? "";
  return /application\/json/i.test(tipo) ? postManual(req, u) : postMultipart(req, u);
}

/* -------------------------------------------------------------- JSON ---- */

async function postManual(req: Request, u: Usuario) {
  if (Number(req.headers.get("content-length") ?? 0) > 2 * 1024 * 1024) return erro("Envio grande demais.", 413);
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição inválido.", 400);
  }
  const parsed = envioManualSchema.safeParse(corpo);
  if (!parsed.success) return erro(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);

  const ctx = await contexto(u, parsed.data, false);
  if (ctx instanceof NextResponse) return ctx;

  const entradas = Array.isArray(parsed.data.nota) ? parsed.data.nota : [parsed.data.nota];
  const bloqueio = checarLote(ctx.p, entradas.length);
  if (bloqueio) return bloqueio;

  const falhas: SaidaOrdenada[] = [];
  const lidos: Lido[] = [];
  entradas.forEach((e, ordem) => {
    const m = notaManualSchema.safeParse(e);
    if (m.success) {
      const nota = notaDeEntrada(m.data, "manual");
      lidos.push({ ordem, arquivo: `Nota ${nota.numero || ordem + 1}`, nota });
    } else {
      const i = m.error.issues[0];
      falhas.push({ ordem, arquivo: `Nota ${ordem + 1}`, erro: i ? `${i.path.join(".")}: ${i.message}` : "Dados inválidos." });
    }
  });

  // Uma nota só e inválida: devolve os erros por campo para o formulário
  if (entradas.length === 1 && lidos.length === 0) {
    const m = notaManualSchema.safeParse(entradas[0]);
    const campos: Record<string, string> = {};
    if (!m.success) for (const i of m.error.issues) campos[i.path.join(".")] ??= i.message;
    return erro("Confira os campos marcados.", 400, { campos });
  }

  return finalizar(ctx, lidos, falhas);
}

/* --------------------------------------------------------- multipart ---- */

async function postMultipart(req: Request, u: Usuario) {
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > MAX_ARQUIVOS * TAMANHO_MAXIMO_ARQUIVO + 1024 * 1024) {
    return erro(`Envio grande demais. Mande até ${MAX_ARQUIVOS} arquivos de 2 MB.`, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return erro("Envie os arquivos como formulário (multipart).", 400);
  }
  const campo = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const parsed = envioSchema.safeParse({ ano: campo("ano"), cenarioId: campo("cenarioId"), empresaId: campo("empresaId") });
  if (!parsed.success) return erro(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);

  const fonte = campo("fonte") ?? "xml";
  const exemplo = fonte === "xml" && campo("exemplo") === "1";
  const ctx = await contexto(u, parsed.data, exemplo);
  if (ctx instanceof NextResponse) return ctx;

  if (fonte === "documento") return postDocumento(ctx, form.get("arquivo"));
  if (fonte === "planilha") return postPlanilha(ctx, form.get("arquivo"));
  if (fonte !== "xml") return erro("Forma de envio inválida.", 400);

  const arquivos = form.getAll("arquivos").filter((f): f is File => typeof f !== "string");
  if (!exemplo) {
    if (arquivos.length === 0) return erro("Escolha pelo menos um arquivo .xml.", 400);
    if (arquivos.length > MAX_ARQUIVOS) return erro(`Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`, 400);
    const bloqueio = checarLote(ctx.p, arquivos.length);
    if (bloqueio) return bloqueio;
  }

  // Leitura: erro num arquivo não derruba o lote
  const falhas: SaidaOrdenada[] = [];
  const lidos: Lido[] = [];
  const entradas = exemplo
    ? [{ nome: "nota-de-exemplo.xml", ler: async () => XML_EXEMPLO, invalido: null }]
    : arquivos.map((f) => ({ nome: f.name.slice(0, 200), ler: () => f.text(), invalido: validarArquivo(f) }));
  for (const [ordem, e] of entradas.entries()) {
    if (e.invalido) {
      falhas.push({ ordem, arquivo: e.nome, erro: e.invalido });
      continue;
    }
    try {
      const xml = (await e.ler()).replace(/^﻿/, "");
      lidos.push({ ordem, arquivo: e.nome, xml, nota: lerNota(xml) });
    } catch (err) {
      falhas.push({
        ordem,
        arquivo: e.nome,
        erro: err instanceof ErroLeituraNota ? err.message : "Não foi possível ler este arquivo.",
      });
    }
  }
  return finalizar(ctx, lidos, falhas);
}

/** PDF ou foto: a extração conta 1 conversão e não depende do saldo de classificações com IA. */
async function postDocumento(ctx: Contexto, f: FormDataEntryValue | null) {
  if (!f || typeof f === "string") return erro("Escolha o PDF ou a foto da nota.", 400);
  if (!extracaoDisponivel()) {
    return erro("A leitura de PDF e foto está indisponível no momento. Use a aba Digitar.", 503, { indisponivel: true });
  }
  if (f.size === 0) return erro("O arquivo está vazio.", 400);
  if (f.size > TAMANHO_MAXIMO_PDF) return erro("Arquivo grande demais (máx. 10 MB para PDF e 5 MB para foto).", 413);

  // Confere o limite antes de gastar a extração
  const limite = await checarLimite(ctx, 1);
  if (limite instanceof NextResponse) return limite;

  let extraida;
  try {
    const bytes = Buffer.from(await f.arrayBuffer());
    extraida = await extrairNotaDeDocumento({ bytes, mimeType: f.type || "application/octet-stream" });
  } catch (err) {
    if (err instanceof ErroExtracao) {
      const status = err.codigo === "arquivo" ? 400 : err.codigo === "indisponivel" ? 503 : 422;
      return erro(err.message, status, err.codigo === "indisponivel" ? { indisponivel: true } : {});
    }
    console.error("[converter] falha na extração", err);
    return erro("Não foi possível ler o documento agora. Tente de novo ou use a aba Digitar.", 500);
  }

  const m = notaManualSchema.safeParse(extraida.nota);
  if (!m.success) return erro("Os dados lidos do documento vieram incompletos. Use a aba Digitar.", 422);
  const nota = notaDeEntrada(m.data, "documento");
  return finalizar(ctx, [{ ordem: 0, arquivo: f.name.slice(0, 200) || "documento", nota }], [], {
    extracao: { confianca: extraida.confianca, avisos: extraida.avisos },
  });
}

async function postPlanilha(ctx: Contexto, f: FormDataEntryValue | null) {
  if (!f || typeof f === "string") return erro("Escolha a planilha .csv.", 400);
  if (!/\.(csv|txt)$/i.test(f.name)) return erro("Envie a planilha em .csv (no Excel: Salvar como > CSV).", 400);
  if (f.type && !/^(text\/(csv|plain)|application\/(vnd\.ms-excel|csv|octet-stream))$/i.test(f.type)) {
    return erro("O arquivo não é um CSV.", 400);
  }
  if (f.size === 0) return erro("A planilha está vazia.", 400);
  if (f.size > TAMANHO_MAXIMO_PLANILHA) return erro("Planilha grande demais (máx. 2 MB).", 413);
  const texto = await f.text();
  if (texto.includes("\u0000")) return erro("O arquivo não é um CSV de texto. No Excel, use Salvar como > CSV.", 400);

  const { notas, erros } = lerPlanilhaNotas(texto);
  if (notas.length === 0) return erro("Nenhuma nota da planilha pôde ser lida. Veja os erros por linha.", 400, { erros });
  if (notas.length > MAX_NOTAS_ENVIO) {
    return erro(`A planilha tem ${notas.length} notas. Envie até ${MAX_NOTAS_ENVIO} por vez.`, 400, { erros });
  }
  const bloqueio = checarLote(ctx.p, notas.length);
  if (bloqueio) return bloqueio;

  const lidos: Lido[] = notas.map((e, ordem) => {
    const nota = notaDeEntrada(notaManualSchema.parse(e), "planilha");
    return { ordem, arquivo: `Nota ${nota.numero}, ${nota.emitente.nome}`.slice(0, 200), nota };
  });
  return finalizar(ctx, lidos, [], { planilha: { erros } });
}

/* ------------------------------------------------------------ comuns ---- */

async function contexto(
  u: Usuario,
  dados: { ano: number; cenarioId?: string; empresaId?: string },
  exemplo: boolean,
): Promise<Contexto | NextResponse> {
  if (dados.empresaId) {
    const empresa = await db.empresa.findFirst({ where: { id: dados.empresaId, userId: u.id }, select: { id: true } });
    if (!empresa) return erro("Empresa não encontrada.", 404);
  }
  return { u, p: plano(u.plano), ano: dados.ano, cenario: cenarioPorId(dados.cenarioId), empresaId: dados.empresaId, exemplo };
}

function checarLote(p: Plano, quantas: number) {
  if (p.classificacaoLote || quantas <= 1) return null;
  return erro(
    "A conversão em lote está nos planos Profissional e Escritório Contábil. Envie 1 nota por vez.",
    402,
    { upgrade: "/app/conta" },
  );
}

/** Confere se ainda cabem `quantas` conversões no mês. */
async function checarLimite(ctx: Contexto, quantas: number): Promise<{ usados: number } | NextResponse> {
  const usados = await conversoesNoMes(ctx.u.id);
  if (ctx.exemplo || quantas === 0) return { usados };
  const restantes = Math.max(ctx.p.conversoesMes - usados, 0);
  if (quantas <= restantes) return { usados };
  const msg =
    restantes === 0
      ? `Você já converteu as ${ctx.p.conversoesMes.toLocaleString("pt-BR")} notas do plano ${ctx.p.nome} neste mês. Mude de plano para continuar.`
      : `Restam ${restantes} conversões neste mês e você enviou ${quantas} notas. Envie menos notas ou mude de plano.`;
  return erro(msg, 402, { upgrade: "/app/conta", uso: { usados, limite: ctx.p.conversoesMes } });
}

/** Limite do mês, conversão, refinamento por IA, gravação e resposta. */
async function finalizar(ctx: Contexto, lidos: Lido[], falhas: SaidaOrdenada[], extra: Record<string, unknown> = {}) {
  const limite = await checarLimite(ctx, lidos.length);
  if (limite instanceof NextResponse) return limite;
  const { usados } = limite;
  const { u, p, ano, cenario, empresaId, exemplo } = ctx;

  // 1) Primeira conversão: o conversor usa a nota e as palavras-chave
  const primeiras = lidos.map((l) => converter(l.nota, { ano, cenario, escolhas: {} }));

  // 2) Refinamento por IA dos itens sem classificação segura, dentro do saldo do plano.
  //    A nota de exemplo não usa IA, para não gastar classificações do usuário.
  let aviso: string | undefined;
  let classificacoesUsadas: number | null = null;
  const porDescricao = new Map<string, Escolha>();
  if (!exemplo && iaDisponivel() && lidos.length > 0) {
    const pendentes = new Set<string>();
    for (const c of primeiras) {
      for (const it of c.resultado.itens) {
        const d = chaveDescricao(it.descricao);
        if ((it.origem === "palavras-chave" || it.origem === "padrao") && d.length >= 2) pendentes.add(d);
      }
    }
    if (pendentes.size > 0) {
      const usadas = await classificacoesNoMes(u.id);
      const saldo = Math.max(p.classificacoesMes - usadas, 0);
      const enviar = [...pendentes].slice(0, saldo);
      classificacoesUsadas = usadas;
      if (enviar.length < pendentes.size) {
        aviso =
          saldo === 0
            ? "As classificações com IA do mês acabaram. Os itens foram classificados por palavras-chave; confira cada um."
            : `Restavam ${saldo} classificações com IA neste mês. Os demais itens ficaram com a busca por palavras-chave.`;
      }
      if (enviar.length > 0) {
        const r = await classificar(enviar).catch((err) => {
          console.error("[converter] falha na IA", err);
          return { modo: "palavras-chave" as const, itens: [], aviso: "A classificação com IA está indisponível agora. Usamos palavras-chave; confira os itens." };
        });
        // Só conta e só aplica o que a IA realmente classificou
        const daIa = r.itens.filter((i) => i.origem === "ia");
        if (daIa.length) {
          await db.classificacao.createMany({
            data: daIa.map((i) => ({ userId: u.id, descricao: i.descricao, resultado: JSON.stringify(i) })),
          });
          classificacoesUsadas += daIa.length;
        }
        for (const i of daIa) {
          porDescricao.set(i.descricao, { categoriaId: i.categoriaId, origem: "ia", confianca: i.confianca, conferir: i.conferir });
        }
        if (r.aviso) aviso = aviso ? `${aviso} ${r.aviso}` : r.aviso;
      }
    }
  }

  // 3) Reconverte com as escolhas da IA e grava
  const saidas: SaidaOrdenada[] = [...falhas];
  for (let k = 0; k < lidos.length; k++) {
    const l = lidos[k];
    try {
      const escolhas: Record<string, Escolha> = {};
      for (const it of primeiras[k].resultado.itens) {
        const e = porDescricao.get(chaveDescricao(it.descricao));
        if (e && (it.origem === "palavras-chave" || it.origem === "padrao")) escolhas[String(it.nItem)] = e;
      }
      const { resultado } = Object.keys(escolhas).length > 0 ? converter(l.nota, { ano, cenario, escolhas }) : primeiras[k];
      const reg = await db.conversaoNota.create({
        data: {
          userId: u.id,
          empresaId: empresaId ?? null,
          chave: l.nota.chave.slice(0, 60),
          numero: l.nota.numero.slice(0, 20),
          emitente: (l.nota.emitente.nome || l.nota.emitente.documento).slice(0, 200),
          ano: resultado.ano,
          resultado: JSON.stringify(resultado),
          fonte: l.nota.fonte,
          // XML na fonte "xml"; nas demais, o JSON da entrada (nunca o arquivo enviado)
          xmlOriginal: conteudoOriginal(l.nota, l.xml),
        },
        select: { id: true, empresaId: true, createdAt: true, chave: true, fonte: true, xmlOriginal: true },
      });
      saidas.push({ ordem: l.ordem, arquivo: l.arquivo, conversao: paraView(reg, resultado) });
    } catch (err) {
      console.error("[converter] falha ao converter", l.arquivo, err);
      saidas.push({ ordem: l.ordem, arquivo: l.arquivo, erro: "Não foi possível converter esta nota." });
    }
  }

  // Mantém a ordem de envio
  saidas.sort((a, b) => a.ordem - b.ordem);
  const resultados: Saida[] = saidas.map(({ ordem: _ordem, ...s }) => {
    void _ordem;
    return s;
  });

  const convertidas = resultados.filter((s) => "conversao" in s).length;
  return NextResponse.json({
    resultados,
    aviso,
    uso: { usados: usados + (exemplo ? 0 : convertidas), limite: p.conversoesMes },
    classificacoes: classificacoesUsadas === null ? undefined : { usados: classificacoesUsadas, limite: p.classificacoesMes },
    ...extra,
  });
}
