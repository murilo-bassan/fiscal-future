import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { classificar, iaDisponivel } from "@/lib/classificador";
import { classificacoesNoMes } from "@/lib/uso";
import { ErroLeituraNota, lerNota, type NotaLida } from "@/lib/nfe";
import {
  MAX_ARQUIVOS,
  TAMANHO_MAXIMO_ARQUIVO,
  envioSchema,
  validarArquivo,
  type ConversaoView,
  type Escolha,
} from "@/components/conversor/modelo";
import { XML_EXEMPLO } from "./_lib/exemplo";
import { cenarioPorId, conversoesNoMes, converter, exigirSessao, paraView } from "./_lib/servico";

export const runtime = "nodejs";
// Com IA, um lote de 50 notas pode levar alguns minutos.
export const maxDuration = 300;

type Lido = { arquivo: string; xml: string; nota: NotaLida };
type Saida = { arquivo: string; conversao: ConversaoView } | { arquivo: string; erro: string };

const chaveDescricao = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 300);

/**
 * POST multipart: arquivos (um ou mais .xml), ano, cenarioId?, empresaId?.
 * Ou `exemplo=1` sem arquivos, para converter a nota de exemplo (não conta no limite).
 */
export async function POST(req: Request) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;

  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (tamanho > MAX_ARQUIVOS * TAMANHO_MAXIMO_ARQUIVO + 1024 * 1024) {
    return NextResponse.json({ erro: `Envio grande demais. Mande até ${MAX_ARQUIVOS} arquivos de 2 MB.` }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: "Envie os arquivos como formulário (multipart)." }, { status: 400 });
  }

  const campo = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const parsed = envioSchema.safeParse({ ano: campo("ano"), cenarioId: campo("cenarioId"), empresaId: campo("empresaId") });
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { ano, cenarioId, empresaId } = parsed.data;
  const cenario = cenarioPorId(cenarioId);

  if (empresaId) {
    const empresa = await db.empresa.findFirst({ where: { id: empresaId, userId: u.id }, select: { id: true } });
    if (!empresa) return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });
  }

  const p = plano(u.plano);
  const exemplo = campo("exemplo") === "1";
  const arquivos = form.getAll("arquivos").filter((f): f is File => typeof f !== "string");

  if (!exemplo) {
    if (arquivos.length === 0) return NextResponse.json({ erro: "Escolha pelo menos um arquivo .xml." }, { status: 400 });
    if (arquivos.length > MAX_ARQUIVOS) {
      return NextResponse.json({ erro: `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.` }, { status: 400 });
    }
    if (!p.classificacaoLote && arquivos.length > 1) {
      return NextResponse.json(
        {
          erro: "A conversão em lote está nos planos Profissional e Escritório Contábil. Envie 1 nota por vez.",
          upgrade: "/app/conta",
        },
        { status: 402 },
      );
    }
  }

  // 1) Leitura: erro num arquivo não derruba o lote
  const saidas: Saida[] = [];
  const lidos: Lido[] = [];
  const entradas = exemplo ? [{ nome: "nota-de-exemplo.xml", ler: async () => XML_EXEMPLO, invalido: null }] : arquivos.map((f) => ({ nome: f.name.slice(0, 200), ler: () => f.text(), invalido: validarArquivo(f) }));
  for (const e of entradas) {
    if (e.invalido) {
      saidas.push({ arquivo: e.nome, erro: e.invalido });
      continue;
    }
    try {
      const xml = (await e.ler()).replace(/^﻿/, "");
      lidos.push({ arquivo: e.nome, xml, nota: lerNota(xml) });
    } catch (err) {
      saidas.push({
        arquivo: e.nome,
        erro: err instanceof ErroLeituraNota ? err.message : "Não foi possível ler este arquivo.",
      });
    }
  }

  // 2) Limite do mês: conta só as notas que deu para ler
  const usados = await conversoesNoMes(u.id);
  if (!exemplo && lidos.length > 0) {
    const restantes = Math.max(p.conversoesMes - usados, 0);
    if (lidos.length > restantes) {
      const msg =
        restantes === 0
          ? `Você já converteu as ${p.conversoesMes.toLocaleString("pt-BR")} notas do plano ${p.nome} neste mês. Mude de plano para continuar.`
          : `Restam ${restantes} conversões neste mês e você enviou ${lidos.length} notas. Envie menos arquivos ou mude de plano.`;
      return NextResponse.json(
        { erro: msg, upgrade: "/app/conta", uso: { usados, limite: p.conversoesMes } },
        { status: 402 },
      );
    }
  }

  // 3) Primeira conversão: o conversor usa a nota e as palavras-chave
  const primeiras = lidos.map((l) => converter(l.nota, { ano, cenario, escolhas: {} }));

  // 4) Refinamento por IA dos itens sem classificação segura, dentro do saldo do plano.
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
          porDescricao.set(i.descricao, {
            categoriaId: i.categoriaId,
            origem: "ia",
            confianca: i.confianca,
            conferir: i.conferir,
          });
        }
        if (r.aviso) aviso = aviso ? `${aviso} ${r.aviso}` : r.aviso;
      }
    }
  }

  // 5) Reconverte com as escolhas da IA e grava
  for (let k = 0; k < lidos.length; k++) {
    const l = lidos[k];
    try {
      const escolhas: Record<string, Escolha> = {};
      for (const it of primeiras[k].resultado.itens) {
        const e = porDescricao.get(chaveDescricao(it.descricao));
        if (e && (it.origem === "palavras-chave" || it.origem === "padrao")) escolhas[String(it.nItem)] = e;
      }
      const { resultado } =
        Object.keys(escolhas).length > 0 ? converter(l.nota, { ano, cenario, escolhas }) : primeiras[k];
      const reg = await db.conversaoNota.create({
        data: {
          userId: u.id,
          empresaId: empresaId ?? null,
          chave: l.nota.chave.slice(0, 60),
          numero: l.nota.numero.slice(0, 20),
          emitente: (l.nota.emitente.nome || l.nota.emitente.documento).slice(0, 200),
          ano: resultado.ano,
          resultado: JSON.stringify(resultado),
          xmlOriginal: l.xml,
        },
        select: { id: true, empresaId: true, createdAt: true, chave: true },
      });
      saidas.push({ arquivo: l.arquivo, conversao: paraView(reg, resultado) });
    } catch (err) {
      console.error("[converter] falha ao converter", l.arquivo, err);
      saidas.push({ arquivo: l.arquivo, erro: "Não foi possível converter esta nota." });
    }
  }

  // Mantém a ordem de envio
  const ordem = new Map(entradas.map((e, i) => [e.nome, i]));
  saidas.sort((a, b) => (ordem.get(a.arquivo) ?? 0) - (ordem.get(b.arquivo) ?? 0));

  const convertidas = saidas.filter((s) => "conversao" in s).length;
  return NextResponse.json({
    resultados: saidas,
    aviso,
    uso: { usados: usados + (exemplo ? 0 : convertidas), limite: p.conversoesMes },
    classificacoes: classificacoesUsadas === null ? undefined : { usados: classificacoesUsadas, limite: p.classificacoesMes },
  });
}
