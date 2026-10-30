/**
 * Links de redefinição de senha: token aleatório de 256 bits, válido por 1 hora e de uso único.
 * No banco fica só o SHA-256 do token, então um vazamento do banco não entrega links válidos.
 */

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db";

const VALIDADE_MIN = 60;
/** Custo do bcrypt para senhas novas. Hashes antigos (custo 10) continuam valendo. */
export const CUSTO_BCRYPT = 12;

export const novaSenhaSchema = z
  .string()
  .min(8, { error: "Use pelo menos 8 caracteres." })
  .max(72, { error: "Use no máximo 72 caracteres." });

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function gerarTokenSenha(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // Um link novo invalida os anteriores ainda não usados
  await db.tokenSenha.updateMany({ where: { userId, usadoEm: null }, data: { usadoEm: new Date() } });
  await db.tokenSenha.create({
    data: { userId, hash: hash(token), expiraEm: new Date(Date.now() + VALIDADE_MIN * 60_000) },
  });
  return token;
}

/** Token válido? Devolve o userId sem consumir (para mostrar o formulário). */
export async function tokenValido(token: string): Promise<string | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const t = await db.tokenSenha.findUnique({ where: { hash: hash(token) } });
  return t && !t.usadoEm && t.expiraEm > new Date() ? t.userId : null;
}

/** Consome o token (uma vez só, mesmo com dois envios simultâneos). */
export async function consumirToken(token: string): Promise<string | null> {
  const userId = await tokenValido(token);
  if (!userId) return null;
  const { count } = await db.tokenSenha.updateMany({
    where: { hash: hash(token), usadoEm: null, expiraEm: { gt: new Date() } },
    data: { usadoEm: new Date() },
  });
  return count === 1 ? userId : null;
}
