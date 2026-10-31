import { NextResponse } from "next/server";
import { lerResultadoSalvo, nomeArquivo } from "@/components/conversor/modelo";
import { gerarPdfConversao } from "../../_lib/pdf";
import { conversaoDoUsuario, exigirSessao, naoEncontrada, reconverter } from "../../_lib/servico";

export const runtime = "nodejs";

/** PDF da nota convertida, com a conferência e a tarja de "sem valor fiscal". */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;
  const { id } = await params;
  const r = await conversaoDoUsuario(id, u.id);
  if (!r) return naoEncontrada();

  let pdf: Uint8Array;
  let ano: number;
  try {
    const resultado = lerResultadoSalvo(r.resultado) ?? reconverter(r).resultado;
    pdf = await gerarPdfConversao(resultado);
    ano = resultado.ano;
  } catch (err) {
    console.error("[converter] falha ao gerar o PDF", id, err instanceof Error ? err.message : err);
    return NextResponse.json({ erro: "Não foi possível gerar o PDF desta nota." }, { status: 500 });
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo(r.chave, ano, "pdf")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
