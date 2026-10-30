import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { atualizarPendentes } from "@/lib/emissao/servico";
import { limparVencidos } from "@/lib/limite";
import { bearerConfere } from "@/lib/segredo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIA_MS = 24 * 60 * 60 * 1000;

/*
 * Rotina periódica (Vercel Cron, ver vercel.json). A Vercel envia
 * `Authorization: Bearer ${CRON_SECRET}`. Cada etapa roda mesmo se outra falhar.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "Rotina não configurada." }, { status: 503 });
  if (!bearerConfere(req.headers.get("authorization"), segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const agora = new Date();
  const [notas, limites, tokens] = await Promise.allSettled([
    atualizarPendentes(20),
    limparVencidos(agora),
    db.tokenSenha.deleteMany({
      where: { OR: [{ expiraEm: { lt: agora } }, { usadoEm: { lt: new Date(agora.getTime() - 7 * DIA_MS) } }] },
    }),
  ]);

  const valor = <T,>(r: PromiseSettledResult<T>, etapa: string) => {
    if (r.status === "fulfilled") return r.value;
    console.error(`[cron] ${etapa} falhou:`, r.reason instanceof Error ? r.reason.message : r.reason);
    return null;
  };
  const resumo = {
    notas: valor(notas, "notas pendentes"),
    limitesApagados: valor(limites, "limites vencidos")?.count ?? null,
    tokensApagados: valor(tokens, "tokens de senha")?.count ?? null,
  };
  const falhou = [notas, limites, tokens].some((r) => r.status === "rejected");
  return NextResponse.json(resumo, { status: falhou ? 500 : 200 });
}
