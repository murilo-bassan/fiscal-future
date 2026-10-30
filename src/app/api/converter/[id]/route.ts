import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ErroLeituraNota } from "@/lib/nfe";
import { ajusteSchema, lerResultadoSalvo, mesclarEscolhas } from "@/components/conversor/modelo";
import { cenarioPorId, conversaoDoUsuario, exigirSessao, naoEncontrada, paraView, reconverter } from "../_lib/servico";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;
  const { id } = await params;
  const r = await conversaoDoUsuario(id, u.id);
  if (!r) return naoEncontrada();

  const salvo = lerResultadoSalvo(r.resultado);
  if (salvo) return NextResponse.json(paraView(r, salvo));
  // JSON salvo ilegível: refaz a partir do XML original
  try {
    const { resultado } = reconverter(r);
    return NextResponse.json(paraView(r, resultado));
  } catch {
    return NextResponse.json({ erro: "Não foi possível abrir esta conversão." }, { status: 500 });
  }
}

/** PATCH { classificacoes?, ano?, cenarioId?, empresaId? }: reconverte com as escolhas do usuário. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;
  const { id } = await params;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = ajusteSchema.safeParse(corpo);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { classificacoes, ano, cenarioId, empresaId } = parsed.data;

  const r = await conversaoDoUsuario(id, u.id);
  if (!r) return naoEncontrada();

  if (empresaId) {
    const empresa = await db.empresa.findFirst({ where: { id: empresaId, userId: u.id }, select: { id: true } });
    if (!empresa) return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });
  }

  let resultado;
  try {
    const salvo = lerResultadoSalvo(r.resultado);
    const escolhas = mesclarEscolhas(
      salvo?.escolhas ?? {},
      classificacoes,
      salvo?.itens.map((i) => i.nItem) ?? [],
    );
    resultado = reconverter(r, {
      ano,
      cenario: cenarioId ? cenarioPorId(cenarioId) : undefined,
      escolhas,
    }).resultado;
  } catch (err) {
    if (err instanceof ErroLeituraNota) return NextResponse.json({ erro: err.message }, { status: 422 });
    console.error("[converter] falha ao reconverter", id, err);
    return NextResponse.json({ erro: "Não foi possível recalcular esta nota." }, { status: 500 });
  }

  // updateMany com userId no filtro: nunca altera registro de outro usuário
  const n = await db.conversaoNota.updateMany({
    where: { id: r.id, userId: u.id },
    data: {
      ano: resultado.ano,
      resultado: JSON.stringify(resultado),
      ...(empresaId !== undefined ? { empresaId } : {}),
    },
  });
  if (n.count === 0) return naoEncontrada();

  return NextResponse.json(
    paraView({ ...r, empresaId: empresaId !== undefined ? empresaId : r.empresaId }, resultado),
  );
}
