import "server-only";
import { db } from "./db";

/** Primeiro instante do mês corrente (horário do servidor). */
export function inicioDoMes(agora = new Date()) {
  return new Date(agora.getFullYear(), agora.getMonth(), 1);
}

/** Quantas classificações o usuário fez no mês corrente. */
export function classificacoesNoMes(userId: string) {
  return db.classificacao.count({ where: { userId, createdAt: { gte: inicioDoMes() } } });
}
