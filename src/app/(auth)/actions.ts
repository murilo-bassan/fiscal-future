"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarDesafio2fa, criarSessao, desafio2fa, encerrarSessao, revogarSessoes } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { descriptografar } from "@/lib/cripto";
import { db } from "@/lib/db";
import { enviarEmail } from "@/lib/email";
import { consumir, ipDe, mensagemLimite, zerar } from "@/lib/limite";
import { PLANOS, type PlanoId } from "@/lib/planos";
import { CUSTO_BCRYPT, consumirToken, gerarTokenSenha, novaSenhaSchema } from "@/lib/senha";
import { verificar } from "@/lib/totp";

export type EstadoAuth = {
  erro?: string;
  ok?: string;
  campos?: Partial<Record<"nome" | "email" | "senha" | "confirmacao", string>>;
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
  senha: novaSenhaSchema,
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

const ipAtual = async () => ipDe(await headers());

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

  const ip = await ipAtual();
  const limite = await consumir("cadastroIp", ip);
  if (!limite.ok) return { erro: mensagemLimite(limite), valores };

  const existe = await db.user.findUnique({ where: { email: r.data.email }, select: { id: true } });
  if (existe) {
    return {
      campos: { email: "Já existe uma conta com este e-mail. Use a opção Entrar." },
      valores,
    };
  }

  const senhaHash = await bcrypt.hash(r.data.senha, CUSTO_BCRYPT);
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
  await registrar(userId, "login", { ip, detalhe: "cadastro" });

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

  const ip = await ipAtual();
  for (const [regra, valor] of [["loginIp", ip], ["loginEmail", r.data.email]] as const) {
    const a = await consumir(regra, valor);
    if (!a.ok) return { erro: mensagemLimite(a), valores };
  }

  const u = await db.user.findUnique({
    where: { email: r.data.email },
    select: { id: true, senhaHash: true, totpAtivo: true },
  });
  const ok = await bcrypt.compare(r.data.senha, u?.senhaHash ?? HASH_FALSO);
  if (!u || !ok) return generico;

  await zerar("loginEmail", r.data.email);
  if (u.totpAtivo) {
    await criarDesafio2fa(u.id);
    redirect("/entrar/codigo");
  }
  await criarSessao(u.id);
  await registrar(u.id, "login", { ip });
  redirect("/app");
}

/** Segunda etapa do login: o código do aplicativo autenticador. */
export async function verificarCodigo(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const userId = await desafio2fa();
  if (!userId) return { erro: "O tempo para digitar o código acabou. Entre de novo com e-mail e senha." };

  const a = await consumir("codigo2fa", userId);
  if (!a.ok) return { erro: mensagemLimite(a) };

  const u = await db.user.findUnique({
    where: { id: userId },
    select: { totpAtivo: true, totpSegredo: true, totpUltimoPasso: true },
  });
  if (!u?.totpAtivo || !u.totpSegredo) return { erro: "Entre de novo com e-mail e senha." };

  const passo = verificar(descriptografar(u.totpSegredo), String(form.get("codigo") ?? ""), u.totpUltimoPasso);
  if (passo === null) return { erro: "Código incorreto ou vencido. Confira o aplicativo e tente de novo." };

  // updateMany com o passo antigo no filtro: o mesmo código não entra duas vezes
  const { count } = await db.user.updateMany({
    where: { id: userId, totpUltimoPasso: u.totpUltimoPasso },
    data: { totpUltimoPasso: passo },
  });
  if (count !== 1) return { erro: "Este código já foi usado. Espere o próximo." };

  await zerar("codigo2fa", userId);
  await criarSessao(userId);
  await registrar(userId, "login_2fa", { ip: await ipAtual() });
  redirect("/app");
}

async function urlApp() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

const AVISO_ENVIADO =
  "Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova. Ele vale por 1 hora. Confira também o spam.";

export async function esqueciSenha(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const bruto = String(form.get("email") ?? "");
  const r = email.safeParse(bruto);
  if (!r.success) return { campos: { email: r.error.issues[0]?.message }, valores: { email: bruto } };

  const ip = await ipAtual();
  for (const [regra, valor] of [["senhaEsquecidaIp", ip], ["senhaEsquecidaEmail", r.data]] as const) {
    const a = await consumir(regra, valor);
    if (!a.ok) return { erro: mensagemLimite(a), valores: { email: bruto } };
  }

  // A resposta é a mesma com ou sem conta: não revela quem é cliente
  const u = await db.user.findUnique({ where: { email: r.data }, select: { id: true, nome: true } });
  if (u) {
    const token = await gerarTokenSenha(u.id);
    const link = `${await urlApp()}/redefinir-senha?token=${token}`;
    await enviarEmail({
      para: r.data,
      assunto: "Fiscal Future: redefinir sua senha",
      texto: [
        `Olá, ${u.nome.split(" ")[0]}.`,
        "",
        "Recebemos um pedido para criar uma senha nova na sua conta do Fiscal Future.",
        `Abra este link em até 1 hora: ${link}`,
        "",
        "Se não foi você, ignore este e-mail: a sua senha continua a mesma.",
      ].join("\n"),
    });
    await registrar(u.id, "senha_esquecida", { ip });
  }
  return { ok: AVISO_ENVIADO };
}

export async function redefinirSenha(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const token = String(form.get("token") ?? "");
  const senha = String(form.get("senha") ?? "");
  const r = novaSenhaSchema.safeParse(senha);
  if (!r.success) return { campos: { senha: r.error.issues[0]?.message } };
  if (senha !== String(form.get("confirmacao") ?? "")) return { campos: { confirmacao: "As duas senhas não são iguais." } };

  const userId = await consumirToken(token);
  if (!userId) return { erro: "Este link venceu ou já foi usado. Peça um novo." };

  await db.user.update({ where: { id: userId }, data: { senhaHash: await bcrypt.hash(r.data, CUSTO_BCRYPT) } });
  await revogarSessoes(userId);
  await registrar(userId, "senha_redefinida", { ip: await ipAtual() });
  // Sem login automático: quem tem verificação em duas etapas ainda precisa do código
  redirect("/entrar?redefinida=1");
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}
