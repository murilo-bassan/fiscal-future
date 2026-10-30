import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { origemValida, stripe, stripeAtivo, urlBase } from "@/lib/billing";

export const runtime = "nodejs";

/** POST (formulário) → Billing Portal do Stripe: trocar cartão, ver faturas, cancelar. */
export async function POST(req: Request) {
  const base = urlBase(req);
  if (!origemValida(req)) return NextResponse.json({ erro: "Origem inválida." }, { status: 403 });

  const u = await usuarioAtual();
  if (!u) return NextResponse.redirect(`${base}/entrar`, 303);
  if (!stripeAtivo() || !u.stripeCustomerId) return NextResponse.redirect(`${base}/app/conta`, 303);

  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: u.stripeCustomerId,
      return_url: `${base}/app/conta`,
      locale: "pt-BR",
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (e) {
    console.error("[portal] erro no Stripe:", e instanceof Error ? e.message : e);
    return NextResponse.redirect(`${base}/app/conta?erro=stripe`, 303);
  }
}
