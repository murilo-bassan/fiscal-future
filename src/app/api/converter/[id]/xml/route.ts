import { NextResponse } from "next/server";
import { nomeArquivo } from "@/components/conversor/modelo";
import { conversaoDoUsuario, exigirSessao, naoEncontrada, reconverter } from "../../_lib/servico";

export const runtime = "nodejs";

/** Download do XML no layout novo, regerado a partir do XML original e das escolhas salvas. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;
  const { id } = await params;
  const r = await conversaoDoUsuario(id, u.id);
  if (!r) return naoEncontrada();

  let xml: string;
  let ano: number;
  try {
    const c = reconverter(r);
    xml = c.xml;
    ano = c.resultado.ano;
  } catch {
    return NextResponse.json({ erro: "Não foi possível gerar o XML desta nota." }, { status: 500 });
  }

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo(r.chave, ano, "xml")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
