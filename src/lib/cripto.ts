/**
 * Criptografia de segredos guardados no banco (ex.: token do provedor fiscal).
 * AES-256-GCM com IV aleatório de 12 bytes. Formato versionado, em base64url:
 *
 *   v1:<iv>:<tag>:<dados>
 *
 * A chave vem de ENCRYPTION_KEY (64 caracteres hex = 32 bytes). Em produção, sem
 * chave válida, tudo falha. Fora de produção, derivamos uma chave do AUTH_SECRET
 * com HKDF para o app funcionar no desenvolvimento (com aviso no console).
 *
 * Usa node:crypto: só roda no servidor.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSAO = "v1";
const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
/** Dados adicionais autenticados: amarram o texto cifrado ao formato v1. */
const AAD = Buffer.from("zeroabi:cripto:v1");

let avisou = false;

export class ErroCripto extends Error {}

function chave(): Buffer {
  const hex = process.env.ENCRYPTION_KEY?.trim();
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");

  if (process.env.NODE_ENV === "production") {
    throw new ErroCripto("ENCRYPTION_KEY ausente ou inválida (são 64 caracteres hexadecimais).");
  }
  if (!avisou) {
    avisou = true;
    console.warn(
      "[cripto] ENCRYPTION_KEY ausente ou inválida: usando chave derivada do AUTH_SECRET (só para desenvolvimento).",
    );
  }
  const segredo = process.env.AUTH_SECRET || "zeroabi-desenvolvimento";
  return Buffer.from(hkdfSync("sha256", segredo, "zeroabi", "cripto-v1", 32));
}

export function criptografar(texto: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const c = createCipheriv(ALGORITMO, chave(), iv, { authTagLength: TAMANHO_TAG });
  c.setAAD(AAD);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [VERSAO, iv.toString("base64url"), tag.toString("base64url"), dados.toString("base64url")].join(":");
}

export function descriptografar(cifrado: string): string {
  const partes = cifrado.split(":");
  if (partes.length !== 4 || partes[0] !== VERSAO) throw new ErroCripto("Formato de dado criptografado desconhecido.");
  const [, ivB64, tagB64, dadosB64] = partes;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== TAMANHO_IV || tag.length !== TAMANHO_TAG) throw new ErroCripto("Dado criptografado corrompido.");
  try {
    const d = createDecipheriv(ALGORITMO, chave(), iv, { authTagLength: TAMANHO_TAG });
    d.setAAD(AAD);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(Buffer.from(dadosB64, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Chave errada ou dado adulterado: a tag GCM não confere
    throw new ErroCripto("Não foi possível descriptografar (chave diferente ou dado adulterado).");
  }
}
