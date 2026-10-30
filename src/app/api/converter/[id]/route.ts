import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { ErroLeituraNota, notaDeEntrada, notaManualSchema } from "@/lib/nfe";
import { ajusteSchema, escolhasMantidas, lerResultadoSalvo, mesclarEscolhas } from "@/components/conversor/modelo";
import {
  cenarioPorId,
  conteudoOriginal,
  conversaoDoUsuario,
  exigirSessao,
  fonteDe,
  naoEncontrada,
  paraView,
  reconverter,
} from "../_lib/servico";

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

const correcaoSchema = z.object({ nota: z.unknown() });

/**
 * PUT { nota: NotaManualEntrada }: corrige os dados de uma conversão sem XML
 * (ex.: um valor que a IA leu errado do PDF) e reconverte. As escolhas de
 * categoria continuam valendo para os itens que não mudaram de descrição.
 * Não conta outra conversão no limite do mês.
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { u, erro } = await exigirSessao();
  if (!u) return erro;
  const { id } = await params;

  if (Number(req.headers.get("content-length") ?? 0) > 1024 * 1024) {
    return NextResponse.json({ erro: "Envio grande demais." }, { status: 413 });
  }
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const envio = correcaoSchema.safeParse(corpo);
  if (!envio.success) return NextResponse.json({ erro: "Envie os dados da nota." }, { status: 400 });
  const m = notaManualSchema.safeParse(envio.data.nota);
  if (!m.success) {
    const campos: Record<string, string> = {};
    for (const i of m.error.issues) campos[i.path.join(".")] ??= i.message;
    return NextResponse.json({ erro: "Confira os campos marcados.", campos }, { status: 400 });
  }

  const r = await conversaoDoUsuario(id, u.id);
  if (!r) return naoEncontrada();
  const fonte = fonteDe(r.fonte);
  if (fonte === "xml") {
    return NextResponse.json(
      { erro: "Notas enviadas em XML não podem ser corrigidas aqui: o XML é o documento original." },
      { status: 409 },
    );
  }

  const nota = notaDeEntrada(m.data, fonte);
  let resultado;
  try {
    const salvo = lerResultadoSalvo(r.resultado);
    const escolhas = escolhasMantidas(salvo?.escolhas ?? {}, salvo?.itens ?? [], nota.itens);
    resultado = reconverter(r, { nota, escolhas }).resultado;
  } catch (err) {
    console.error("[converter] falha ao corrigir", id, err);
    return NextResponse.json({ erro: "Não foi possível recalcular esta nota." }, { status: 500 });
  }

  const xmlOriginal = conteudoOriginal(nota);
  const dados = {
    chave: nota.chave.slice(0, 60),
    numero: nota.numero.slice(0, 20),
    emitente: (nota.emitente.nome || nota.emitente.documento).slice(0, 200),
    ano: resultado.ano,
    resultado: JSON.stringify(resultado),
    xmlOriginal,
  };
  const n = await db.conversaoNota.updateMany({ where: { id: r.id, userId: u.id }, data: dados });
  if (n.count === 0) return naoEncontrada();

  return NextResponse.json(paraView({ ...r, ...dados }, resultado));
}
