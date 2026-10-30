/**
 * Envio de e-mails transacionais pela API do Resend (https://resend.com).
 * Sem RESEND_API_KEY: fora de produção, o e-mail vai para o console (para testar
 * o fluxo); em produção, o envio falha e fica registrado no log.
 */

import "server-only";

export type Email = { para: string; assunto: string; texto: string };

export function emailAtivo() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function enviarEmail(e: Email): Promise<boolean> {
  if (!emailAtivo()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email] (desenvolvimento, não enviado)\nPara: ${e.para}\nAssunto: ${e.assunto}\n\n${e.texto}\n`);
      return true;
    }
    console.error("[email] RESEND_API_KEY ou EMAIL_FROM ausente: e-mail não enviado:", e.assunto);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [e.para], subject: e.assunto, text: e.texto }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.error("[email] Resend recusou o envio:", r.status);
    return r.ok;
  } catch (err) {
    console.error("[email] falha ao enviar:", err instanceof Error ? err.message : err);
    return false;
  }
}
