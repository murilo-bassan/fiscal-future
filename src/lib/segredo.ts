/**
 * Comparação de segredos compartilhados (webhook do Focus, rotina periódica) em tempo
 * constante. Os dois lados viram SHA-256 antes do timingSafeEqual, que exige tamanhos
 * iguais: assim o tempo não revela nem o conteúdo nem o tamanho do segredo.
 */

import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** true só se `recebido` for igual a `esperado`. Segredo vazio nunca confere. */
export function segredoConfere(recebido: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!esperado || recebido == null) return false;
  return timingSafeEqual(sha256(recebido), sha256(esperado));
}

/** Header `Authorization: Bearer <segredo>` (formato da Vercel Cron). */
export function bearerConfere(authorization: string | null | undefined, esperado: string | null | undefined): boolean {
  if (!esperado) return false;
  return segredoConfere(authorization, `Bearer ${esperado}`);
}
