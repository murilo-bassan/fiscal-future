/**
 * Códigos de verificação em duas etapas (TOTP, RFC 6238): HMAC-SHA1, 6 dígitos,
 * passos de 30 s. Funciona com Google Authenticator, Microsoft Authenticator, 1Password etc.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PASSO_SEG = 30;
const DIGITOS = 6;

export function base32(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let out = "";
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALFABETO[(valor << (5 - bits)) & 31];
  return out;
}

export function deBase32(s: string): Buffer {
  const limpo = s.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const c of limpo) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error("Segredo TOTP inválido.");
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Segredo novo de 160 bits, em base32. */
export function novoSegredo(): string {
  return base32(randomBytes(20));
}

export function passoAtual(agoraMs = Date.now()) {
  return Math.floor(agoraMs / 1000 / PASSO_SEG);
}

export function codigo(segredo: string, passo: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(passo));
  const h = createHmac("sha1", deBase32(segredo)).update(contador).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digitos).padStart(digitos, "0");
}

/**
 * Confere o código aceitando um passo antes e um depois (relógio do celular adiantado
 * ou atrasado). Devolve o passo aceito, para o chamador recusar reuso, ou null.
 */
export function verificar(segredo: string, entrada: string, ultimoPasso: number | null = null, agoraMs = Date.now()): number | null {
  const c = entrada.replace(/\D/g, "");
  if (c.length !== DIGITOS) return null;
  const atual = passoAtual(agoraMs);
  for (const p of [atual - 1, atual, atual + 1]) {
    if (ultimoPasso !== null && p <= ultimoPasso) continue;
    if (timingSafeEqual(Buffer.from(codigo(segredo, p)), Buffer.from(c))) return p;
  }
  return null;
}

/** URI para o QR code do aplicativo autenticador. */
export function uriOtpauth(segredo: string, email: string, emissor = "Fiscal Future") {
  const rotulo = encodeURIComponent(`${emissor}:${email}`);
  const q = new URLSearchParams({ secret: segredo, issuer: emissor, algorithm: "SHA1", digits: String(DIGITOS), period: String(PASSO_SEG) });
  return `otpauth://totp/${rotulo}?${q.toString()}`;
}
