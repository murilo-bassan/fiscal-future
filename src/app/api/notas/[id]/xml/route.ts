import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";

/** Só redireciona para arquivos do próprio provedor, por https. */
function urlDoProvedor(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && (url.hostname === "focusnfe.com.br" || url.hostname.endsWith(".focusnfe.com.br"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u) return new Response("Entre na sua conta para baixar o XML.", { status: 401 });

  const { id } = await params;
  const nota = await db.notaFiscal.findFirst({
    where: { id, userId: u.id },
    select: { xml: true, xmlUrl: true, chave: true, ref: true, tipo: true },
  });
  if (!nota) return new Response("Nota não encontrada.", { status: 404 });

  if (nota.xml) {
    const nome = `${nota.chave ?? nota.ref}-${nota.tipo === "nfse" ? "nfse" : "nfe"}.xml`.replace(/[^\w.-]/g, "");
    return new Response(nota.xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const externo = urlDoProvedor(nota.xmlUrl);
  if (externo) return Response.redirect(externo, 302);
  return new Response("O XML desta nota ainda não está disponível.", { status: 404 });
}
