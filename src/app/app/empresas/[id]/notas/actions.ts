"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { consumir, mensagemLimite } from "@/lib/limite";
import {
  atualizarStatus,
  cancelarNota,
  emitirNota,
  retentarNota,
  type FalhaServico,
  type ResultadoServico,
} from "@/lib/emissao/servico";

export type EstadoEmissao = Partial<Omit<FalhaServico, "ok">>;
export type EstadoAcaoNota = { erro?: string; ok?: string; faltando?: string[] };

const caminhoNotas = (empresaId: string) => `/app/empresas/${empresaId}/notas`;

export async function emitirNotaAction(empresaId: string, _: EstadoEmissao, dados: unknown): Promise<EstadoEmissao> {
  const u = await exigirUsuario();
  const limite = await consumir("emissao", u.id);
  if (!limite.ok) return { erro: mensagemLimite(limite) };
  const r = await emitirNota(u.id, empresaId, dados);
  if (!r.ok) {
    const { ok: _ok, ...falha } = r;
    void _ok;
    return falha;
  }
  revalidatePath(caminhoNotas(empresaId));
  redirect(`${caminhoNotas(empresaId)}/${r.notaId}`);
}

function estadoDe(r: ResultadoServico, sucesso: string): EstadoAcaoNota {
  if (!r.ok) return { erro: r.faltando?.length ? `${r.erro} Falta: ${r.faltando.join("; ")}.` : r.erro };
  return { ok: r.mensagem ? `${sucesso} ${r.mensagem}` : sucesso };
}

export async function atualizarStatusAction(empresaId: string, notaId: string): Promise<EstadoAcaoNota> {
  const u = await exigirUsuario();
  const r = await atualizarStatus(u.id, notaId);
  revalidatePath(caminhoNotas(empresaId), "layout");
  return estadoDe(r, "Status atualizado.");
}

export async function cancelarNotaAction(empresaId: string, notaId: string, justificativa: string): Promise<EstadoAcaoNota> {
  const u = await exigirUsuario();
  const r = await cancelarNota(u.id, notaId, String(justificativa ?? ""));
  revalidatePath(caminhoNotas(empresaId), "layout");
  return estadoDe(r, "Nota cancelada.");
}

export async function retentarNotaAction(empresaId: string, notaId: string): Promise<EstadoAcaoNota> {
  const u = await exigirUsuario();
  const limite = await consumir("emissao", u.id);
  if (!limite.ok) return { erro: mensagemLimite(limite) };
  const r = await retentarNota(u.id, notaId);
  revalidatePath(caminhoNotas(empresaId), "layout");
  return estadoDe(r, "Nota enviada de novo.");
}
