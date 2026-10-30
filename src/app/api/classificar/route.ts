import { NextResponse } from "next/server";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { classificar } from "@/lib/classificador";
import { classificacoesNoMes } from "@/lib/uso";

export const runtime = "nodejs";
// Lotes grandes (até 500 itens) fazem várias chamadas à IA.
export const maxDuration = 300;

const MAX_LOTE = 500;

const Entrada = z.object({
  itens: z
    .array(
      z
        .string()
        .transform((s) => s.replace(/\s+/g, " ").trim())
        .pipe(
          z
            .string()
            .min(2, "Cada descrição precisa de pelo menos 2 caracteres.")
            .max(300, "Cada descrição pode ter no máximo 300 caracteres."),
        ),
    )
    .min(1, "Envie pelo menos 1 item.")
    .max(MAX_LOTE, `Envie no máximo ${MAX_LOTE} itens por vez.`),
});

export async function POST(req: Request) {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ erro: "Entre na sua conta para classificar." }, { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = Entrada.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const itens = parsed.data.itens;

  const p = plano(u.plano);
  if (!p.classificacaoLote && itens.length > 1) {
    return NextResponse.json(
      { erro: "A classificação em lote está nos planos Profissional e Escritório Contábil. Envie 1 item por vez." },
      { status: 402 },
    );
  }

  const usados = await classificacoesNoMes(u.id);
  const restantes = Math.max(p.classificacoesMes - usados, 0);
  if (itens.length > restantes) {
    const msg =
      restantes === 0
        ? `Você já usou as ${p.classificacoesMes} classificações do plano ${p.nome} neste mês. Mude de plano para continuar.`
        : `Restam ${restantes} classificações neste mês e você enviou ${itens.length}. Envie menos itens ou mude de plano.`;
    return NextResponse.json({ erro: msg, upgrade: "/app/conta", uso: { usados, limite: p.classificacoesMes } }, { status: 402 });
  }

  const resultado = await classificar(itens);

  await db.classificacao.createMany({
    data: resultado.itens.map((r) => ({ userId: u.id, descricao: r.descricao, resultado: JSON.stringify(r) })),
  });

  return NextResponse.json({
    ...resultado,
    uso: { usados: usados + resultado.itens.length, limite: p.classificacoesMes },
  });
}
