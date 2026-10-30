import { NextResponse } from "next/server";
import { z } from "zod";
import { lerCorpoLimitado } from "@/lib/corpo";
import { atualizarStatusPorRef } from "@/lib/emissao/servico";
import { segredoConfere } from "@/lib/segredo";

export const runtime = "nodejs";

/*
 * Gatilho (webhook) do Focus NFe. Autentica pelo header Authorization configurado
 * no gatilho e usa do corpo SÓ a ref: o status é consultado de novo no Focus, então
 * um aviso forjado ou fora de ordem não muda nada por conta própria.
 *
 * Responde 200 também para ref desconhecida, senão o Focus fica reenviando.
 */

const MAX_BYTES = 64 * 1024;
const avisoSchema = z.object({ ref: z.string().regex(/^[\w-]{1,100}$/) });

export async function POST(req: Request) {
  const segredo = process.env.FOCUS_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ erro: "Webhook não configurado." }, { status: 503 });
  if (!segredoConfere(req.headers.get("authorization"), segredo)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const corpo = await lerCorpoLimitado(req, MAX_BYTES);
  if (!corpo.ok) {
    return corpo.motivo === "grande"
      ? NextResponse.json({ erro: "Corpo grande demais." }, { status: 413 })
      : NextResponse.json({ erro: "Corpo ilegível." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(corpo.texto);
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  const aviso = avisoSchema.safeParse(json);
  if (!aviso.success) return NextResponse.json({ erro: "Sem ref." }, { status: 400 });

  try {
    const r = await atualizarStatusPorRef(aviso.data.ref);
    if (!r.ok) console.warn("[focus] aviso sem efeito", aviso.data.ref, r.erro);
  } catch (e) {
    console.error("[focus] erro ao tratar aviso", aviso.data.ref, e instanceof Error ? e.message : e);
    // 500 faz o Focus tentar de novo mais tarde
    return NextResponse.json({ erro: "Falha ao processar." }, { status: 500 });
  }
  return NextResponse.json({ recebido: true });
}
