"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarSessao, encerrarSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANOS, type PlanoId } from "@/lib/planos";

export type EstadoAuth = {
  erro?: string;
  campos?: Partial<Record<"nome" | "email" | "senha", string>>;
  valores?: { nome?: string; email?: string };
};

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Confira o e-mail: parece incompleto." }));

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, { error: "Escreva seu nome." }).max(120, { error: "Nome longo demais." }),
  email,
  senha: z
    .string()
    .min(8, { error: "Use pelo menos 8 caracteres." })
    .max(72, { error: "Use no máximo 72 caracteres." }),
});

const loginSchema = z.object({
  email,
  senha: z.string().min(1).max(200),
});

/** Hash de uma senha qualquer: comparamos contra ele quando o e-mail não existe, para o tempo de resposta não revelar quem tem conta. */
const HASH_FALSO = "$2b$10$kGhsmVc/oduc7Xar8H5OLezp10Eyty/vRN4mwkGDmYYDaZc4BeUMG";

function planoValido(id: unknown): PlanoId | null {
  return typeof id === "string" && id in PLANOS ? (id as PlanoId) : null;
}

export async function cadastrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = {
    nome: String(form.get("nome") ?? ""),
    email: String(form.get("email") ?? ""),
    senha: String(form.get("senha") ?? ""),
  };
  const valores = { nome: bruto.nome, email: bruto.email };
  const r = cadastroSchema.safeParse(bruto);
  if (!r.success) {
    const campos: EstadoAuth["campos"] = {};
    for (const i of r.error.issues) {
      const k = i.path[0] as keyof NonNullable<EstadoAuth["campos"]>;
      campos[k] ??= i.message;
    }
    return { campos, valores };
  }

  const existe = await db.user.findUnique({ where: { email: r.data.email }, select: { id: true } });
  if (existe) {
    return {
      campos: { email: "Já existe uma conta com este e-mail. Use a opção Entrar." },
      valores,
    };
  }

  const senhaHash = await bcrypt.hash(r.data.senha, 10);
  let userId: string;
  try {
    const u = await db.user.create({
      data: { nome: r.data.nome, email: r.data.email, senhaHash },
      select: { id: true },
    });
    userId = u.id;
  } catch {
    // corrida rara: dois cadastros simultâneos com o mesmo e-mail
    return { erro: "Não foi possível criar a conta agora. Tente de novo.", valores };
  }
  await criarSessao(userId);

  const p = planoValido(form.get("plano"));
  if (p && PLANOS[p].precoMensal > 0) redirect(`/app/conta?assinar=${p}`);
  redirect("/app/empresas/nova");
}

export async function entrar(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = { email: String(form.get("email") ?? ""), senha: String(form.get("senha") ?? "") };
  const valores = { email: bruto.email };
  const generico: EstadoAuth = { erro: "E-mail ou senha incorretos.", valores };

  const r = loginSchema.safeParse(bruto);
  if (!r.success) return generico;

  const u = await db.user.findUnique({
    where: { email: r.data.email },
    select: { id: true, senhaHash: true },
  });
  const ok = await bcrypt.compare(r.data.senha, u?.senhaHash ?? HASH_FALSO);
  if (!u || !ok) return generico;

  await criarSessao(u.id);
  redirect("/app");
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}
