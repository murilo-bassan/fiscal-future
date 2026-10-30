import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type NotaPainel = {
  empresaId?: string;
  createdAt: Date;
  valorTotal: number;
  ibsCbsTotal: number;
  status: string;
  destinatario: string | null;
};

export type ResumoMensal = { mes: string; notas: number; faturamento: number; ibsCbs: number };

/** Agrupa datas pelo calendário local informado, sem depender de funções SQL específicas. */
export function agruparPorMes(notas: NotaPainel[], quantidade = 12, referencia = new Date()): ResumoMensal[] {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth() - quantidade + 1, 1);
  const meses = Array.from({ length: quantidade }, (_, i) => {
    const data = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    return { mes, notas: 0, faturamento: 0, ibsCbs: 0 };
  });
  const porMes = new Map(meses.map((mes) => [mes.mes, mes]));
  for (const nota of notas) {
    const chave = `${nota.createdAt.getFullYear()}-${String(nota.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const mes = porMes.get(chave);
    if (mes && nota.status === "autorizada") {
      mes.notas += 1;
      mes.faturamento += nota.valorTotal;
      mes.ibsCbs += nota.ibsCbsTotal;
    }
  }
  return meses;
}

export function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export function rankingDestinatarios(notas: NotaPainel[], limite = 5) {
  const ranking = new Map<string, { destinatario: string; notas: number; faturamento: number }>();
  for (const nota of notas) {
    if (nota.status !== "autorizada" || !nota.destinatario?.trim()) continue;
    const nome = nota.destinatario.trim();
    const item = ranking.get(nome) ?? { destinatario: nome, notas: 0, faturamento: 0 };
    item.notas += 1;
    item.faturamento += nota.valorTotal;
    ranking.set(nome, item);
  }
  return [...ranking.values()].sort((a, b) => b.faturamento - a.faturamento || b.notas - a.notas).slice(0, limite);
}

export const filtroTeste = (incluirTeste: boolean): Prisma.NotaFiscalWhereInput =>
  incluirTeste ? {} : { ambiente: "producao", provedor: { not: "simulado" } };

const camposPainel = { empresaId: true, createdAt: true, valorTotal: true, ibsCbsTotal: true, status: true, destinatario: true } as const;

export async function notasDoMes(userId: string, empresaId?: string, incluirTeste = false, agora = new Date()) {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return db.notaFiscal.findMany({
    where: { userId, ...(empresaId ? { empresaId } : {}), ...filtroTeste(incluirTeste), createdAt: { gte: inicio, lt: fim } },
    select: camposPainel,
  });
}

export async function notasDosUltimosMeses(userId: string, empresaId: string, incluirTeste = false, agora = new Date()) {
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
  return db.notaFiscal.findMany({
    where: { userId, empresaId, ...filtroTeste(incluirTeste), createdAt: { gte: inicio } },
    select: camposPainel,
  });
}

export async function listarNotas(userId: string, empresaId: string, filtros: {
  status?: string; tipo?: string; busca?: string; inicio?: Date; fim?: Date; incluirTeste: boolean; pagina: number;
}) {
  const where: Prisma.NotaFiscalWhereInput = {
    userId,
    empresaId,
    ...filtroTeste(filtros.incluirTeste),
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.busca ? { OR: [
      { numero: { contains: filtros.busca } },
      { destinatario: { contains: filtros.busca } },
    ] } : {}),
    ...(filtros.inicio || filtros.fim ? { createdAt: { ...(filtros.inicio ? { gte: filtros.inicio } : {}), ...(filtros.fim ? { lt: filtros.fim } : {}) } } : {}),
  };
  const [notas, total] = await Promise.all([
    db.notaFiscal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filtros.pagina - 1) * 25,
      take: 25,
      select: { id: true, tipo: true, numero: true, serie: true, status: true, valorTotal: true, ibsCbsTotal: true, destinatario: true, ambiente: true, provedor: true, createdAt: true },
    }),
    db.notaFiscal.count({ where }),
  ]);
  return { notas, total };
}

export async function conversoesDoMes(userId: string, agora = new Date()) {
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return db.conversaoNota.count({ where: { userId, createdAt: { gte: inicio, lt: fim } } });
}
