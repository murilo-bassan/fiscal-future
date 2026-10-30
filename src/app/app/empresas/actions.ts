"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { registrar } from "@/lib/auditoria";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { ipDe } from "@/lib/limite";
import { plano } from "@/lib/planos";
import { PRESETS, perfilSchema, type PerfilEmpresa } from "@/lib/tax";
import { CAMPOS_NUMERICOS } from "@/components/app/camposPerfil";
import { lerPercentual, lerValor } from "@/components/app/formato";

export type EstadoEmpresa = {
  erro?: string;
  campos?: Record<string, string>;
};

const MSG_TIPO = {
  valor: "Informe um valor em reais (ex.: 1.250.000).",
  percentual: "Informe um percentual entre 0 e 100.",
  dias: "Informe um número de dias entre 0 e 365.",
} as const;

/**
 * Converte o formulário em PerfilEmpresa. Percentuais chegam em pontos (18) e
 * viram fração (0,18). Campos ausentes (escondidos por não se aplicarem ao
 * regime/atividade) entram como zero.
 */
function lerFormulario(form: FormData) {
  const campos: Record<string, string> = {};
  const bruto: Record<string, unknown> = {
    nome: String(form.get("nome") ?? ""),
    regime: form.get("regime"),
    atividade: form.get("atividade"),
    reducaoVendas: form.get("reducaoVendas") ?? "padrao",
    reducaoCompras: form.get("reducaoCompras") ?? "padrao",
  };

  for (const c of CAMPOS_NUMERICOS) {
    const v = form.get(c.chave);
    const texto = typeof v === "string" ? v.trim() : "";
    if (!texto) {
      bruto[c.chave] = 0;
      continue;
    }
    if (c.tipo === "valor") bruto[c.chave] = lerValor(texto);
    else if (c.tipo === "percentual") bruto[c.chave] = lerPercentual(texto) / 100;
    else bruto[c.chave] = lerPercentual(texto);
    if (Number.isNaN(bruto[c.chave])) campos[c.chave] = MSG_TIPO[c.tipo];
  }

  const r = perfilSchema.safeParse(bruto);
  if (!r.success) {
    for (const i of r.error.issues) {
      const k = String(i.path[0]);
      if (campos[k]) continue;
      const meta = CAMPOS_NUMERICOS.find((c) => c.chave === k);
      if (k === "nome") campos[k] = "Dê um nome à empresa (até 120 caracteres).";
      else if (k === "receitaAnual") campos[k] = "Informe o faturamento (maior que zero).";
      else if (meta) campos[k] = MSG_TIPO[meta.tipo];
      else campos[k] = "Escolha uma opção.";
    }
  }

  const cnpj = String(form.get("cnpj") ?? "").replace(/\D/g, "");
  if (cnpj && cnpj.length !== 14) campos.cnpj = "O CNPJ tem 14 dígitos. Deixe em branco se preferir.";

  const cenarioId = String(form.get("cenarioId") ?? "");
  if (!PRESETS.some((p) => p.id === cenarioId)) campos.cenarioId = "Escolha um cenário de alíquota.";

  if (Object.keys(campos).length > 0 || !r.success) {
    return { ok: false as const, campos };
  }
  return { ok: true as const, perfil: r.data as PerfilEmpresa, cnpj: cnpj || null, cenarioId };
}

const ERRO_CAMPOS = "Alguns campos precisam de ajuste. Veja as mensagens abaixo de cada um.";

export async function criarEmpresa(_: EstadoEmpresa, form: FormData): Promise<EstadoEmpresa> {
  const u = await exigirUsuario();
  const limite = plano(u.plano).empresas;
  const total = await db.empresa.count({ where: { userId: u.id } });
  if (total >= limite) {
    return {
      erro: `Seu plano permite ${limite} ${limite === 1 ? "empresa" : "empresas"}. Mude de plano em Conta para cadastrar mais.`,
    };
  }

  const r = lerFormulario(form);
  if (!r.ok) return { erro: ERRO_CAMPOS, campos: r.campos };

  const e = await db.empresa.create({
    data: {
      userId: u.id,
      nome: r.perfil.nome,
      cnpj: r.cnpj,
      perfil: JSON.stringify(r.perfil),
      cenarioId: r.cenarioId,
    },
    select: { id: true },
  });
  revalidatePath("/app");
  redirect(`/app/empresas/${e.id}`);
}

export async function atualizarEmpresa(
  id: string,
  _: EstadoEmpresa,
  form: FormData,
): Promise<EstadoEmpresa> {
  const u = await exigirUsuario();
  const r = lerFormulario(form);
  if (!r.ok) return { erro: ERRO_CAMPOS, campos: r.campos };

  // O filtro por userId garante que ninguém altera empresa de outra conta.
  const { count } = await db.empresa.updateMany({
    where: { id, userId: u.id },
    data: {
      nome: r.perfil.nome,
      cnpj: r.cnpj,
      perfil: JSON.stringify(r.perfil),
      cenarioId: r.cenarioId,
    },
  });
  if (count === 0) return { erro: "Empresa não encontrada." };

  revalidatePath("/app");
  revalidatePath(`/app/empresas/${id}`);
  redirect(`/app/empresas/${id}`);
}

export async function excluirEmpresa(id: string) {
  const u = await exigirUsuario();
  const empresa = await db.empresa.findFirst({ where: { id, userId: u.id }, select: { nome: true, cnpj: true } });
  const { count } = await db.empresa.deleteMany({ where: { id, userId: u.id } });
  if (count > 0 && empresa) {
    // A empresa some; o nome vai no detalhe para o histórico continuar legível
    await registrar(u.id, "empresa_excluida", {
      empresaId: id,
      detalhe: [empresa.nome, empresa.cnpj].filter(Boolean).join(" · "),
      ip: ipDe(await headers()),
    });
  }
  revalidatePath("/app");
  redirect("/app");
}
