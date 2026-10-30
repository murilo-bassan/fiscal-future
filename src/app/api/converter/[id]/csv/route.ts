import { NextResponse } from "next/server";
import { lerResultadoSalvo, montarCsv, nomeArquivo } from "@/components/conversor/modelo";
import { conversaoDoUsuario, exigirSessao, naoEncontrada, reconverter } from "../../_lib/servico";

export const runtime = "nodejs";

/** CSV com uma linha por item da nota convertida. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;
  const { id } = await params;
  const r = await conversaoDoUsuario(id, u.id);
  if (!r) return naoEncontrada();

  let resultado = lerResultadoSalvo(r.resultado);
  if (!resultado) {
    try {
      resultado = reconverter(r).resultado;
    } catch {
      return NextResponse.json({ erro: "Não foi possível gerar o CSV desta nota." }, { status: 500 });
    }
  }

  return new NextResponse(montarCsv(resultado), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo(r.chave, resultado.ano, "csv")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
