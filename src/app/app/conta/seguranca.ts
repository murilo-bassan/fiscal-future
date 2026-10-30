"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { criarSessao, encerrarSessao, exigirUsuario, revogarSessoes } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { stripe, stripeAtivo } from "@/lib/billing";
import { criptografar, descriptografar } from "@/lib/cripto";
import { db } from "@/lib/db";
import { consumir, ipDe, mensagemLimite } from "@/lib/limite";
import { CUSTO_BCRYPT, novaSenhaSchema } from "@/lib/senha";
import { novoSegredo, uriOtpauth, verificar } from "@/lib/totp";

export type EstadoSeguranca = { ok?: string; erro?: string };
export type Configuracao2fa = { segredo: string; qr: string } | { erro: string };

const ipAtual = async () => ipDe(await headers());

/** Confere a senha atual com limite de tentativas (protege quem deixou a sessão aberta). */
async function conferirSenha(userId: string, senha: string): Promise<string | null> {
  const a = await consumir("senhaConta", userId);
  if (!a.ok) return mensagemLimite(a);
  const u = await db.user.findUnique({ where: { id: userId }, select: { senhaHash: true } });
  return u && (await bcrypt.compare(senha, u.senhaHash)) ? null : "Senha atual incorreta.";
}

/** Revoga as outras sessões e mantém esta aberta. */
async function renovarSessao(userId: string) {
  await revogarSessoes(userId);
  await criarSessao(userId);
}

export async function trocarSenha(_: EstadoSeguranca, form: FormData): Promise<EstadoSeguranca> {
  const u = await exigirUsuario();
  const nova = String(form.get("nova") ?? "");
  const r = novaSenhaSchema.safeParse(nova);
  if (!r.success) return { erro: r.error.issues[0]?.message };
  if (nova !== String(form.get("confirmacao") ?? "")) return { erro: "As duas senhas novas não são iguais." };

  const falha = await conferirSenha(u.id, String(form.get("atual") ?? ""));
  if (falha) return { erro: falha };

  await db.user.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(r.data, CUSTO_BCRYPT) } });
  await renovarSessao(u.id);
  await registrar(u.id, "senha_alterada", { ip: await ipAtual() });
  revalidatePath("/app/conta");
  return { ok: "Senha trocada. As sessões em outros aparelhos foram encerradas." };
}

export async function sairDeTodos(): Promise<EstadoSeguranca> {
  const u = await exigirUsuario();
  await renovarSessao(u.id);
  await registrar(u.id, "logout_todos", { ip: await ipAtual() });
  revalidatePath("/app/conta");
  return { ok: "Pronto: só este aparelho continua conectado." };
}

/** Gera um segredo pendente (só vale depois de confirmado com um código). */
export async function iniciar2fa(): Promise<Configuracao2fa> {
  const u = await exigirUsuario();
  if (u.totpAtivo) return { erro: "A verificação em duas etapas já está ativa." };
  const segredo = novoSegredo();
  await db.user.update({ where: { id: u.id }, data: { totpSegredo: criptografar(segredo), totpUltimoPasso: null } });
  const qr = await QRCode.toDataURL(uriOtpauth(segredo, u.email), { margin: 1, width: 220 });
  return { segredo, qr };
}

export async function confirmar2fa(_: EstadoSeguranca, form: FormData): Promise<EstadoSeguranca> {
  const u = await exigirUsuario();
  const a = await consumir("codigo2fa", u.id);
  if (!a.ok) return { erro: mensagemLimite(a) };
  const dados = await db.user.findUnique({ where: { id: u.id }, select: { totpSegredo: true, totpAtivo: true } });
  if (dados?.totpAtivo) return { ok: "A verificação em duas etapas já está ativa." };
  if (!dados?.totpSegredo) return { erro: "Comece de novo: clique em “Ativar”." };

  const passo = verificar(descriptografar(dados.totpSegredo), String(form.get("codigo") ?? ""));
  if (passo === null) return { erro: "Código incorreto. Confira se o relógio do celular está certo e tente de novo." };

  await db.user.update({ where: { id: u.id }, data: { totpAtivo: true, totpUltimoPasso: passo } });
  await renovarSessao(u.id);
  await registrar(u.id, "2fa_ativado", { ip: await ipAtual() });
  revalidatePath("/app/conta");
  return { ok: "Verificação em duas etapas ativada. Nos próximos logins vamos pedir o código." };
}

export async function desativar2fa(_: EstadoSeguranca, form: FormData): Promise<EstadoSeguranca> {
  const u = await exigirUsuario();
  const falha = await conferirSenha(u.id, String(form.get("senha") ?? ""));
  if (falha) return { erro: falha };
  const dados = await db.user.findUnique({ where: { id: u.id }, select: { totpSegredo: true, totpUltimoPasso: true } });
  if (!dados?.totpSegredo) return { erro: "A verificação em duas etapas não está ativa." };
  if (verificar(descriptografar(dados.totpSegredo), String(form.get("codigo") ?? ""), dados.totpUltimoPasso) === null) {
    return { erro: "Código incorreto." };
  }
  await db.user.update({ where: { id: u.id }, data: { totpAtivo: false, totpSegredo: null, totpUltimoPasso: null } });
  await registrar(u.id, "2fa_desativado", { ip: await ipAtual() });
  revalidatePath("/app/conta");
  return { ok: "Verificação em duas etapas desativada." };
}

/**
 * Exclui a conta e tudo o que pertence a ela (empresas, notas, conversões, histórico).
 * Cancela a assinatura antes: sem isso, o cliente continuaria sendo cobrado.
 */
export async function excluirConta(_: EstadoSeguranca, form: FormData): Promise<EstadoSeguranca> {
  const u = await exigirUsuario();
  if (String(form.get("confirmacao") ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return { erro: "Digite EXCLUIR para confirmar." };
  }
  const falha = await conferirSenha(u.id, String(form.get("senha") ?? ""));
  if (falha) return { erro: falha };

  const dados = await db.user.findUnique({ where: { id: u.id }, select: { stripeSubscriptionId: true } });
  if (dados?.stripeSubscriptionId && stripeAtivo()) {
    try {
      await stripe().subscriptions.cancel(dados.stripeSubscriptionId);
    } catch (err) {
      console.error("[conta] falha ao cancelar a assinatura", err instanceof Error ? err.message : err);
      return { erro: "Não conseguimos cancelar a assinatura agora. Tente de novo ou cancele em “Gerenciar assinatura”." };
    }
  }
  await db.user.delete({ where: { id: u.id } });
  await encerrarSessao();
  redirect("/");
}
