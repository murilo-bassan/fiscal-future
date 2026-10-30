import path from "node:path";
import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/*
 * CSP sem nonce: o Next injeta scripts inline na hidratação, então script-src precisa
 * de 'unsafe-inline' (e de 'unsafe-eval' no dev, para o React Refresh). As fontes vêm
 * de next/font/google, que as serve do próprio domínio: nada do Google no navegador.
 * form-action inclui o Stripe porque o navegador também aplica a regra ao redirect
 * 303 que o /api/checkout e o /api/portal devolvem depois do POST do formulário.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const headersSeguranca = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Há outro package-lock.json acima desta pasta; fixa a raiz do projeto.
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: headersSeguranca }];
  },
};

export default nextConfig;
