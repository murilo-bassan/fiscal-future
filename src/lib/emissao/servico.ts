/**
 * Orquestra a emissão: valida, confere o limite do plano, monta o emitente,
 * calcula (calcularRascunho é a única fonte dos valores), grava a nota como
 * "processando" ANTES de chamar o provedor (a ref fica estável para novas
 * tentativas) e guarda o resultado. Toda operação filtra pelo dono.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import type { Empresa, NotaFiscal } from "@prisma/client";
import { db } from "../db";
import { plano } from "../planos";
import { DEFAULT_CENARIO, PRESETS } from "../tax/params";
import { calcularRascunho, type CalculoRascunho } from "./calculo";
import { emitenteDaEmpresa } from "./emitente";
import { provedor } from "./provedores";
import {
  checarLimite,
  gerarRef,
  inicioDoMes,
  validarJustificativa,
  validarRascunho,
  type ErrosRascunho,
} from "./regras";
import type { EmitenteFiscal, RascunhoNota, ResultadoEmissao, StatusNota } from "./tipos";

export type FalhaServico = {
  ok: false;
  erro: string;
  erros?: ErrosRascunho;
  mensagens?: string[];
  faltando?: string[];
  upgrade?: boolean;
};
export type SucessoServico = { ok: true; notaId: string; status: StatusNota; mensagem?: string };
export type ResultadoServico = SucessoServico | FalhaServico;

const cenario = (id: string) => PRESETS.find((p) => p.id === id) ?? DEFAULT_CENARIO;

export function notasNoMes(userId: string) {
  return db.notaFiscal.count({ where: { userId, createdAt: { gte: inicioDoMes() }, status: { not: "erro" } } });
}

async function conferirLimite(userId: string): Promise<FalhaServico | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { plano: true } });
  if (!u) return { ok: false, erro: "Sessão inválida. Entre de novo." };
  const limite = checarLimite(await notasNoMes(userId), plano(u.plano).notasMes);
  return limite.ok ? null : { ok: false, erro: limite.erro, upgrade: true };
}

function montarEmitente(empresa: Empresa, tipo: RascunhoNota["tipo"]): EmitenteFiscal | FalhaServico {
  const r = emitenteDaEmpresa(empresa, tipo);
  if (r.ok) return r.emitente;
  return { ok: false, erro: "Faltam dados fiscais da empresa para emitir.", faltando: r.faltando };
}

/** Grava só os campos que o provedor devolveu (não apaga chave/número já conhecidos). */
async function gravar(notaId: string, r: ResultadoEmissao, manterStatus = false) {
  const data: Record<string, string | null> = { mensagem: r.mensagem ?? null };
  if (!manterStatus) data.status = r.status;
  for (const k of ["numero", "serie", "chave", "protocolo", "xml", "xmlUrl", "danfeUrl"] as const) {
    if (r[k] !== undefined) data[k] = r[k];
  }
  await db.notaFiscal.update({ where: { id: notaId }, data });
}

async function enviar(
  nota: Pick<NotaFiscal, "id" | "ref">,
  e: EmitenteFiscal,
  r: RascunhoNota,
  c: CalculoRascunho,
): Promise<SucessoServico> {
  let res: ResultadoEmissao;
  try {
    res = await provedor(e.provedor).emitir(e, r, c, nota.ref);
  } catch (err) {
    console.error("[emissao] falha ao emitir", nota.id, err instanceof Error ? err.message : "erro desconhecido");
    res = { status: "erro", mensagem: "Falha inesperada ao enviar a nota. Tente de novo em instantes." };
  }
  await gravar(nota.id, res);
  return { ok: true, notaId: nota.id, status: res.status, mensagem: res.mensagem };
}

export async function emitirNota(userId: string, empresaId: string, dados: unknown): Promise<ResultadoServico> {
  const v = validarRascunho(dados);
  if (!v.ok) {
    return { ok: false, erro: "Alguns campos precisam de ajuste.", erros: v.erros, mensagens: v.mensagens };
  }
  const rascunho = v.rascunho;

  const empresa = await db.empresa.findFirst({ where: { id: empresaId, userId } });
  if (!empresa) return { ok: false, erro: "Empresa não encontrada." };

  const limite = await conferirLimite(userId);
  if (limite) return limite;

  const e = montarEmitente(empresa, rascunho.tipo);
  if ("ok" in e) return e;

  const calculo = calcularRascunho(e, rascunho, { ano: new Date().getFullYear(), cenario: cenario(empresa.cenarioId) });

  const nota = await db.notaFiscal.create({
    data: {
      userId,
      empresaId: empresa.id,
      tipo: rascunho.tipo,
      ref: gerarRef(randomUUID().replace(/-/g, "")),
      provedor: e.provedor,
      ambiente: e.ambiente,
      status: "processando",
      serie: e.serieNfe,
      payload: JSON.stringify(rascunho),
      calculo: JSON.stringify(calculo),
      valorTotal: calculo.totais.nota,
      ibsCbsTotal: calculo.totais.ibsCbs,
      origemChave: rascunho.origemChave ?? null,
    },
    select: { id: true, ref: true },
  });

  return enviar(nota, e, rascunho, calculo);
}

async function notaDoUsuario(userId: string, notaId: string) {
  return db.notaFiscal.findFirst({ where: { id: notaId, userId }, include: { empresa: true } });
}

/** Emitente com o provedor e o ambiente em que a nota foi emitida (não os atuais da empresa). */
function emitenteDaNota(nota: NotaFiscal & { empresa: Empresa }): EmitenteFiscal | FalhaServico {
  const r = emitenteDaEmpresa({ ...nota.empresa, provedor: nota.provedor, ambiente: nota.ambiente });
  if (r.ok) return r.emitente;
  return { ok: false, erro: "Faltam dados fiscais da empresa para falar com o provedor.", faltando: r.faltando };
}

/**
 * Nova tentativa de uma nota que deu "erro" (ex.: dados fiscais corrigidos).
 * Reusa a mesma ref: se o envio anterior chegou ao provedor, ele não duplica.
 */
export async function retentarNota(userId: string, notaId: string): Promise<ResultadoServico> {
  const nota = await notaDoUsuario(userId, notaId);
  if (!nota) return { ok: false, erro: "Nota não encontrada." };
  if (nota.status !== "erro") return { ok: false, erro: "Só dá para tentar de novo uma nota com erro." };

  const v = validarRascunho(JSON.parse(nota.payload));
  if (!v.ok) return { ok: false, erro: "O rascunho salvo tem campos inválidos. Crie uma nova nota.", mensagens: v.mensagens };

  const limite = await conferirLimite(userId);
  if (limite) return limite;

  const e = montarEmitente(nota.empresa, v.rascunho.tipo);
  if ("ok" in e) return e;
  const calculo = calcularRascunho(e, v.rascunho, { ano: new Date().getFullYear(), cenario: cenario(nota.empresa.cenarioId) });

  await db.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status: "processando",
      mensagem: null,
      provedor: e.provedor,
      ambiente: e.ambiente,
      serie: e.serieNfe,
      calculo: JSON.stringify(calculo),
      valorTotal: calculo.totais.nota,
      ibsCbsTotal: calculo.totais.ibsCbs,
    },
  });
  return enviar(nota, e, v.rascunho, calculo);
}

export async function atualizarStatus(userId: string, notaId: string): Promise<ResultadoServico> {
  const nota = await notaDoUsuario(userId, notaId);
  if (!nota) return { ok: false, erro: "Nota não encontrada." };
  const e = emitenteDaNota(nota);
  if ("ok" in e) return e;

  let res: ResultadoEmissao;
  try {
    res = await provedor(nota.provedor).consultar(e, nota.tipo as RascunhoNota["tipo"], nota.ref);
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Não foi possível consultar o provedor." };
  }
  // Uma consulta que falha não rebaixa uma nota já resolvida (autorizada, cancelada, rejeitada)
  const resolvida = nota.status !== "processando" && nota.status !== "erro";
  const manter = res.status === "erro" && resolvida;
  await gravar(nota.id, res, manter);
  return { ok: true, notaId: nota.id, status: manter ? (nota.status as StatusNota) : res.status, mensagem: res.mensagem };
}

export async function cancelarNota(userId: string, notaId: string, justificativa: string): Promise<ResultadoServico> {
  const j = validarJustificativa(justificativa);
  if (!j.ok) return { ok: false, erro: j.erro };

  const nota = await notaDoUsuario(userId, notaId);
  if (!nota) return { ok: false, erro: "Nota não encontrada." };
  if (nota.status !== "autorizada") return { ok: false, erro: "Só dá para cancelar uma nota autorizada." };
  const e = emitenteDaNota(nota);
  if ("ok" in e) return e;

  let res: ResultadoEmissao;
  try {
    res = await provedor(nota.provedor).cancelar(e, nota.tipo as RascunhoNota["tipo"], nota.ref, j.justificativa);
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Não foi possível falar com o provedor." };
  }
  if (res.status !== "cancelada") {
    await db.notaFiscal.update({ where: { id: nota.id }, data: { mensagem: res.mensagem ?? null } });
    return { ok: false, erro: res.mensagem ?? "O cancelamento não foi aceito." };
  }
  await gravar(nota.id, res);
  return { ok: true, notaId: nota.id, status: "cancelada", mensagem: res.mensagem };
}
