import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { db } from "@/lib/db";
import { ehPlanoPago, modoDemonstracao, origemValida, precoDoPlano, stripe, stripeAtivo, urlBase } from "@/lib/billing";

export const runtime = "nodejs";

function voltar(base: string, query: string) {
  return NextResponse.redirect(`${base}/app/conta${query}`, 303);
}

/** POST (formulário) { plano } → Checkout do Stripe, ou troca direta no modo demonstração. */
export async function POST(req: Request) {
  const base = urlBase(req);
  if (!origemValida(req)) return NextResponse.json({ erro: "Origem inválida." }, { status: 403 });

  const u = await usuarioAtual();
  if (!u) return NextResponse.redirect(`${base}/entrar`, 303);

  const form = await req.formData().catch(() => null);
  const planoId = form?.get("plano");

  // Modo demonstração: só fora de produção. Permite também voltar ao Grátis.
  if (!stripeAtivo()) {
    if (!modoDemonstracao()) {
      return NextResponse.json({ erro: "Cobrança indisponível no momento. Tente mais tarde." }, { status: 503 });
    }
    if (planoId !== "gratis" && !ehPlanoPago(planoId)) return voltar(base, "?erro=plano");
    await db.user.update({ where: { id: u.id }, data: { plano: planoId } });
    return voltar(base, "?demo=1");
  }

  if (!ehPlanoPago(planoId)) return voltar(base, "?erro=plano");
  const price = precoDoPlano(planoId);
  if (!price) {
    console.error(`[checkout] preço do plano ${planoId} não configurado (STRIPE_PRICE_*)`);
    return voltar(base, "?erro=config");
  }

  const s = stripe();
  try {
    const usuario = await db.user.findUniqueOrThrow({
      where: { id: u.id },
      select: { stripeCustomerId: true, stripeSubscriptionId: true },
    });

    // Já tem assinatura ativa: trocar de plano pelo Portal (com tela de
    // confirmação e proração), em vez de criar uma segunda assinatura.
    if (usuario.stripeCustomerId && usuario.stripeSubscriptionId) {
      const sub = await s.subscriptions.retrieve(usuario.stripeSubscriptionId).catch(() => null);
      if (sub && ["active", "trialing", "past_due"].includes(sub.status)) {
        const item = sub.items.data[0];
        if (item?.price.id === price) return voltar(base, "");
        try {
          const portal = await s.billingPortal.sessions.create({
            customer: usuario.stripeCustomerId,
            return_url: `${base}/app/conta`,
            flow_data: {
              type: "subscription_update_confirm",
              subscription_update_confirm: {
                subscription: sub.id,
                items: [{ id: item.id, price, quantity: 1 }],
              },
              after_completion: { type: "redirect", redirect: { return_url: `${base}/app/conta?ok=1` } },
            },
          });
          return NextResponse.redirect(portal.url, 303);
        } catch (e) {
          // Portal sem "atualizar assinatura" habilitado: abre o portal comum.
          console.error("[checkout] fluxo de troca no portal falhou:", e instanceof Error ? e.message : e);
          const portal = await s.billingPortal.sessions.create({
            customer: usuario.stripeCustomerId,
            return_url: `${base}/app/conta`,
          });
          return NextResponse.redirect(portal.url, 303);
        }
      }
    }

    // Cria ou reutiliza o customer.
    let customerId = usuario.stripeCustomerId;
    if (!customerId) {
      const customer = await s.customers.create(
        { email: u.email, name: u.nome, metadata: { userId: u.id } },
        { idempotencyKey: `customer-${u.id}` },
      );
      customerId = customer.id;
      await db.user.update({ where: { id: u.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      locale: "pt-BR",
      // Só cartão por enquanto (filtro sobre os métodos ligados no painel).
      // Para boleto e Pix: ligue os métodos em Dashboard → Settings → Payment
      // methods (dependem de conta brasileira e da aprovação do Stripe) e
      // acrescente "boleto" / "pix" aqui, ou remova esta linha para usar tudo
      // o que estiver ligado no painel. Com boleto o pagamento fica pendente
      // por dias: o webhook já trata checkout.session.async_payment_succeeded.
      allowed_payment_method_types: ["card"],
      client_reference_id: u.id,
      metadata: { userId: u.id, plano: planoId },
      subscription_data: { metadata: { userId: u.id, plano: planoId } },
      allow_promotion_codes: true,
      success_url: `${base}/app/conta?ok=1`,
      cancel_url: `${base}/app/conta`,
    });
    if (!session.url) throw new Error("Checkout Session sem URL");
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    console.error("[checkout] erro no Stripe:", e instanceof Error ? e.message : e);
    return voltar(base, "?erro=stripe");
  }
}
