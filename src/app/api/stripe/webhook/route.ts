import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { ehPlanoPago, planoDoPreco, stripe, stripeAtivo } from "@/lib/billing";

export const runtime = "nodejs";

/*
 * Webhook do Stripe. Nada aqui é confiável sem assinatura válida.
 *
 * Idempotente: cada evento só GRAVA o estado final (plano, customer,
 * assinatura). Receber o mesmo evento duas vezes dá o mesmo resultado, e um
 * evento de uma assinatura antiga não derruba o plano de uma assinatura nova.
 */

const STATUS_ATIVOS = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

export async function POST(req: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeAtivo() || !segredo) {
    return NextResponse.json({ erro: "Webhook não configurado." }, { status: 503 });
  }

  const assinatura = req.headers.get("stripe-signature");
  if (!assinatura) return NextResponse.json({ erro: "Sem assinatura." }, { status: 400 });

  const corpo = await req.text(); // corpo cru: a assinatura é calculada sobre os bytes exatos
  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 400 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await checkoutConcluido(evento.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await assinaturaAtualizada(evento.data.object);
        break;
      case "customer.subscription.deleted":
        await assinaturaEncerrada(evento.data.object);
        break;
      default:
        break; // eventos que não usamos: responde 200 para o Stripe não reenviar
    }
  } catch (e) {
    console.error(`[webhook] erro ao tratar ${evento.type} (${evento.id}):`, e instanceof Error ? e.message : e);
    // 500 faz o Stripe tentar de novo mais tarde.
    return NextResponse.json({ erro: "Falha ao processar." }, { status: 500 });
  }

  return NextResponse.json({ recebido: true });
}

const idDe = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function checkoutConcluido(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  // Boleto/Pix: "completed" chega antes do pagamento; o plano só sobe quando pago.
  if (session.payment_status === "unpaid") return;

  const userId = session.client_reference_id ?? session.metadata?.userId;
  const customerId = idDe(session.customer);
  const subscriptionId = idDe(session.subscription);
  if (!userId || !customerId || !subscriptionId) return;

  // O plano vem do price da assinatura (fonte da verdade); metadata é reserva.
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const planoId = planoDoPreco(sub.items.data[0]?.price.id) ?? session.metadata?.plano;
  if (!ehPlanoPago(planoId)) {
    console.error(`[webhook] checkout ${session.id} sem plano reconhecido`);
    return;
  }

  const usuario = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!usuario) return;

  // Se outro usuário estiver com este customer (não deveria), não sobrescreve.
  const dono = await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  if (dono && dono.id !== userId) {
    console.error(`[webhook] customer ${customerId} pertence a outro usuário`);
    return;
  }

  await db.user.update({
    where: { id: userId },
    data: {
      plano: STATUS_ATIVOS.has(sub.status) ? planoId : "gratis",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  });
}

async function assinaturaAtualizada(sub: Stripe.Subscription) {
  const usuario = await usuarioDaAssinatura(sub);
  if (!usuario) return;

  // Ignora eventos de uma assinatura antiga se o usuário já tem outra.
  if (usuario.stripeSubscriptionId && usuario.stripeSubscriptionId !== sub.id && !STATUS_ATIVOS.has(sub.status)) return;

  const planoId = planoDoPreco(sub.items.data[0]?.price.id);
  const novoPlano = STATUS_ATIVOS.has(sub.status) && planoId ? planoId : "gratis";
  await db.user.update({
    where: { id: usuario.id },
    data: { plano: novoPlano, stripeSubscriptionId: sub.id },
  });
}

async function assinaturaEncerrada(sub: Stripe.Subscription) {
  const usuario = await usuarioDaAssinatura(sub);
  if (!usuario) return;
  if (usuario.stripeSubscriptionId && usuario.stripeSubscriptionId !== sub.id) return;
  await db.user.update({
    where: { id: usuario.id },
    data: { plano: "gratis", stripeSubscriptionId: null },
  });
}

async function usuarioDaAssinatura(sub: Stripe.Subscription) {
  const customerId = idDe(sub.customer);
  const sel = { id: true, stripeSubscriptionId: true } as const;
  if (customerId) {
    const u = await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: sel });
    if (u) return u;
  }
  // Reserva: metadata que gravamos na assinatura pelo checkout.
  const userId = sub.metadata?.userId;
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { ...sel, stripeCustomerId: true } });
  // Só aceita se o usuário ainda não tem customer, ou se é o mesmo.
  if (!u || (u.stripeCustomerId && u.stripeCustomerId !== customerId)) return null;
  return u;
}
