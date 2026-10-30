import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import {
  ErroLeituraNota,
  converterNota,
  entradaDeNota,
  lerNota,
  notaDeEntrada,
  notaManualSchema,
  type FonteNota,
  type NotaLida,
  type NotaManualEntrada,
} from "@/lib/nfe";
import { DEFAULT_CENARIO, PRESETS, type CenarioAliquota } from "@/lib/tax/params";
import { inicioDoMes } from "@/lib/uso";
import {
  aplicarEscolhas,
  classificacoesDe,
  lerResultadoSalvo,
  type ConversaoView,
  type Escolha,
  type ResultadoSalvo,
  type ResumoConversao,
} from "@/components/conversor/modelo";
import { CHAVE_EXEMPLO } from "./exemplo";

export function cenarioPorId(id: string | null | undefined): CenarioAliquota {
  return PRESETS.find((c) => c.id === id) ?? DEFAULT_CENARIO;
}

/** Converte com as escolhas guardadas. Devolve o que vai para o banco e o XML. */
export function converter(
  nota: NotaLida,
  opcoes: { ano: number; cenario: CenarioAliquota; escolhas: Record<string, Escolha> },
): { resultado: ResultadoSalvo; xml: string } {
  const conv = converterNota(nota, {
    ano: opcoes.ano,
    cenario: opcoes.cenario,
    classificacoes: classificacoesDe(opcoes.escolhas),
  });
  return { resultado: aplicarEscolhas(conv, opcoes.escolhas), xml: conv.xml };
}

/**
 * Conversões do mês que contam no limite. A nota de exemplo (XML com a chave
 * do exemplo) não conta; digitar a mesma chave numa nota manual conta.
 */
export function conversoesNoMes(userId: string) {
  return db.conversaoNota.count({
    where: { userId, createdAt: { gte: inicioDoMes() }, NOT: { chave: CHAVE_EXEMPLO, fonte: "xml" } },
  });
}

const ehExemplo = (r: { chave: string; fonte: string }) => r.chave === CHAVE_EXEMPLO && fonteDe(r.fonte) === "xml";

export async function exigirSessao() {
  const u = await usuarioAtual();
  return u
    ? { u, erro: null }
    : { u: null, erro: NextResponse.json({ erro: "Entre na sua conta para converter notas." }, { status: 401 }) };
}

/** Busca a conversão só se for do usuário. */
export function conversaoDoUsuario(id: string, userId: string) {
  return db.conversaoNota.findFirst({ where: { id, userId } });
}

type Registro = NonNullable<Awaited<ReturnType<typeof conversaoDoUsuario>>>;

const FONTES: FonteNota[] = ["xml", "manual", "documento", "planilha"];

/** Fonte gravada no banco; qualquer valor desconhecido é tratado como XML (registros antigos). */
export function fonteDe(v: string | null | undefined): FonteNota {
  return FONTES.includes(v as FonteNota) ? (v as FonteNota) : "xml";
}

/** O que vai em xmlOriginal: o XML, ou o JSON da entrada para as fontes sem XML. */
export function conteudoOriginal(nota: NotaLida, xml?: string): string {
  return nota.fonte === "xml" && xml !== undefined ? xml : JSON.stringify(entradaDeNota(nota));
}

/** Lê a entrada guardada de uma conversão sem XML. */
function entradaGuardada(json: string): NotaManualEntrada {
  try {
    return JSON.parse(json) as NotaManualEntrada;
  } catch {
    throw new ErroLeituraNota("Não foi possível ler os dados guardados desta nota.");
  }
}

/**
 * Remonta a NotaLida de um registro, despachando pela fonte: XML original
 * ou JSON de NotaManualEntrada (digitada, documento, planilha).
 */
export function notaDoRegistro(r: { fonte: string; xmlOriginal: string }): NotaLida {
  const fonte = fonteDe(r.fonte);
  if (fonte === "xml") return lerNota(r.xmlOriginal);
  const m = notaManualSchema.safeParse(entradaGuardada(r.xmlOriginal));
  if (!m.success) throw new ErroLeituraNota("Os dados guardados desta nota estão incompletos.");
  return notaDeEntrada(m.data, fonte);
}

export function paraView(
  r: Pick<Registro, "id" | "empresaId" | "createdAt" | "chave" | "fonte" | "xmlOriginal">,
  resultado: ResultadoSalvo,
): ConversaoView {
  const fonte = fonteDe(r.fonte);
  let entrada: NotaManualEntrada | null = null;
  if (fonte !== "xml") {
    try {
      entrada = entradaGuardada(r.xmlOriginal);
    } catch {
      entrada = null;
    }
  }
  return {
    id: r.id,
    empresaId: r.empresaId,
    createdAt: r.createdAt.toISOString(),
    exemplo: ehExemplo(r),
    fonte,
    entrada,
    resultado,
  };
}

export function resumo(
  r: Pick<Registro, "id" | "numero" | "emitente" | "ano" | "createdAt" | "chave" | "resultado" | "fonte">,
): ResumoConversao {
  const salvo = lerResultadoSalvo(r.resultado);
  return {
    id: r.id,
    numero: r.numero,
    emitente: r.emitente,
    ano: r.ano,
    createdAt: r.createdAt.toISOString(),
    variacao: salvo ? salvo.totais.variacao : null,
    exemplo: ehExemplo(r),
    fonte: fonteDe(r.fonte),
  };
}

/**
 * Recalcula a partir do conteúdo original guardado (XML ou dados da nota). Se o JSON salvo estiver
 * corrompido, refaz do zero (sem escolhas).
 */
export function reconverter(
  r: Pick<Registro, "xmlOriginal" | "resultado" | "ano" | "fonte">,
  mudancas: { ano?: number; cenario?: CenarioAliquota; escolhas?: Record<string, Escolha>; nota?: NotaLida } = {},
) {
  const salvo = lerResultadoSalvo(r.resultado);
  const nota = mudancas.nota ?? notaDoRegistro(r);
  return {
    nota,
    salvo,
    ...converter(nota, {
      ano: mudancas.ano ?? salvo?.ano ?? r.ano,
      cenario: mudancas.cenario ?? cenarioPorId(salvo?.cenario.id),
      escolhas: mudancas.escolhas ?? salvo?.escolhas ?? {},
    }),
  };
}

export const naoEncontrada = () => NextResponse.json({ erro: "Conversão não encontrada." }, { status: 404 });
