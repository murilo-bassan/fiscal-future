import "server-only";
import Stripe from "stripe";
import type { PlanoId } from "./planos";

/** Cobrança real ligada? (sem a chave, o app roda em modo demonstração) */
export function stripeAtivo() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Modo demonstração: sem Stripe e fora de produção. Troca o plano direto. */
export function modoDemonstracao() {
  return !stripeAtivo() && process.env.NODE_ENV !== "production";
}

let cliente: Stripe | null = null;

/** Cliente do Stripe (só no servidor). Lança erro se a chave não estiver definida. */
export function stripe(): Stripe {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) throw new Error("STRIPE_SECRET_KEY não definida");
  // Sem apiVersion: usa a versão fixada pela biblioteca stripe instalada.
  cliente ??= new Stripe(chave, { appInfo: { name: "Fiscal Future" } });
  return cliente;
}

export type PlanoPagoId = Exclude<PlanoId, "gratis">;

export const PLANOS_PAGOS_IDS: PlanoPagoId[] = ["essencial", "profissional", "contador"];

export function ehPlanoPago(id: unknown): id is PlanoPagoId {
  return typeof id === "string" && (PLANOS_PAGOS_IDS as string[]).includes(id);
}

const ENV_PRECO: Record<PlanoPagoId, string> = {
  essencial: "STRIPE_PRICE_ESSENCIAL",
  profissional: "STRIPE_PRICE_PROFISSIONAL",
  contador: "STRIPE_PRICE_CONTADOR",
};

/** Price ID do Stripe para o plano (ou null se a variável não estiver definida). */
export function precoDoPlano(id: PlanoPagoId): string | null {
  return process.env[ENV_PRECO[id]] || null;
}

/** Caminho inverso: qual plano corresponde a um price ID do Stripe. */
export function planoDoPreco(priceId: string | null | undefined): PlanoPagoId | null {
  if (!priceId) return null;
  return PLANOS_PAGOS_IDS.find((id) => precoDoPlano(id) === priceId) ?? null;
}

/** URL base do app (para success_url, return_url etc.). */
export function urlBase(req: Request) {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

/**
 * Proteção simples contra CSRF nos POSTs de formulário: se o navegador mandou
 * Origin, ele tem que ser o próprio app.
 */
export function origemValida(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const permitidas = new Set([new URL(req.url).origin]);
  if (process.env.APP_URL) permitidas.add(new URL(process.env.APP_URL).origin);
  return permitidas.has(origin);
}

