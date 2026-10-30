import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth";
import { converterNota, lerNota, type NotaLida } from "@/lib/nfe";
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

/** Conversões do mês que contam no limite (a nota de exemplo não conta). */
export function conversoesNoMes(userId: string) {
  return db.conversaoNota.count({
    where: { userId, createdAt: { gte: inicioDoMes() }, NOT: { chave: CHAVE_EXEMPLO } },
  });
}

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

export function paraView(r: Pick<Registro, "id" | "empresaId" | "createdAt" | "chave">, resultado: ResultadoSalvo): ConversaoView {
  return {
    id: r.id,
    empresaId: r.empresaId,
    createdAt: r.createdAt.toISOString(),
    exemplo: r.chave === CHAVE_EXEMPLO,
    resultado,
  };
}

export function resumo(
  r: Pick<Registro, "id" | "numero" | "emitente" | "ano" | "createdAt" | "chave" | "resultado">,
): ResumoConversao {
  const salvo = lerResultadoSalvo(r.resultado);
  return {
    id: r.id,
    numero: r.numero,
    emitente: r.emitente,
    ano: r.ano,
    createdAt: r.createdAt.toISOString(),
    variacao: salvo ? salvo.totais.variacao : null,
    exemplo: r.chave === CHAVE_EXEMPLO,
  };
}

/**
 * Recalcula a partir do XML original guardado. Se o JSON salvo estiver
 * corrompido, refaz do zero (sem escolhas).
 */
export function reconverter(
  r: Pick<Registro, "xmlOriginal" | "resultado" | "ano">,
  mudancas: { ano?: number; cenario?: CenarioAliquota; escolhas?: Record<string, Escolha> } = {},
) {
  const salvo = lerResultadoSalvo(r.resultado);
  const nota = lerNota(r.xmlOriginal);
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
