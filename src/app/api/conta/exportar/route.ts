import { usuarioAtual } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { ipDe } from "@/lib/limite";

export const runtime = "nodejs";

/** Lê um campo JSON salvo como texto; se estiver corrompido, devolve o texto. */
function json(s: string | null) {
  if (s === null) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return s;
  }
}

/**
 * Cópia dos dados do usuário (LGPD, art. 18). Sem segredos: hash da senha,
 * segredo do 2FA e token do provedor fiscal ficam de fora.
 */
export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u) return new Response("Entre na sua conta para baixar os seus dados.", { status: 401 });

  const [conta, empresas, notas, conversoes, classificacoes, eventos] = await Promise.all([
    db.user.findUnique({
      where: { id: u.id },
      select: { id: true, nome: true, email: true, plano: true, escritorio: true, totpAtivo: true, createdAt: true },
    }),
    db.empresa.findMany({ where: { userId: u.id }, omit: { provedorToken: true } }),
    db.notaFiscal.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
    db.conversaoNota.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
    db.classificacao.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
    db.eventoAuditoria.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const dados = {
    geradoEm: new Date().toISOString(),
    conta,
    empresas: empresas.map((e) => ({ ...e, perfil: json(e.perfil), endereco: json(e.endereco) })),
    notas: notas.map((n) => ({ ...n, payload: json(n.payload), calculo: json(n.calculo) })),
    conversoes: conversoes.map((c) => ({ ...c, resultado: json(c.resultado) })),
    classificacoes: classificacoes.map((c) => ({ ...c, resultado: json(c.resultado) })),
    atividade: eventos,
  };

  await registrar(u.id, "conta_exportada", { ip: ipDe(req.headers) });
  const dia = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fiscal-future-dados-${dia}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
