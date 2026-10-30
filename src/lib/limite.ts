/**
 * Limite de tentativas por janela fixa (login, cadastro, código 2FA, IA, emissão).
 * O contador fica no banco para valer entre instâncias do servidor (serverless).
 * As chaves com e-mail ou IP são guardadas como SHA-256: a tabela não guarda dado pessoal.
 */

import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

export type Regra = { limite: number; janelaSeg: number };

export const REGRAS = {
  /** por e-mail: 8 senhas erradas em 15 min */
  loginEmail: { limite: 8, janelaSeg: 15 * 60 },
  /** por IP: cobre quem testa muitos e-mails */
  loginIp: { limite: 30, janelaSeg: 15 * 60 },
  cadastroIp: { limite: 10, janelaSeg: 60 * 60 },
  senhaEsquecidaIp: { limite: 10, janelaSeg: 60 * 60 },
  senhaEsquecidaEmail: { limite: 3, janelaSeg: 60 * 60 },
  codigo2fa: { limite: 6, janelaSeg: 15 * 60 },
  senhaConta: { limite: 8, janelaSeg: 15 * 60 },
  /** chamadas caras (IA, conversão, emissão) por usuário */
  ia: { limite: 60, janelaSeg: 10 * 60 },
  emissao: { limite: 60, janelaSeg: 10 * 60 },
} satisfies Record<string, Regra>;

export type Avaliacao = { ok: boolean; contador: number; reiniciaEm: Date };

/** Decisão pura: dado o registro atual, o que fazer com mais uma tentativa. */
export function avaliar(atual: { contador: number; reiniciaEm: Date } | null, regra: Regra, agora = new Date()): Avaliacao & { novaJanela: boolean } {
  if (!atual || atual.reiniciaEm <= agora) {
    return { ok: true, contador: 1, reiniciaEm: new Date(agora.getTime() + regra.janelaSeg * 1000), novaJanela: true };
  }
  if (atual.contador >= regra.limite) return { ok: false, contador: atual.contador, reiniciaEm: atual.reiniciaEm, novaJanela: false };
  return { ok: true, contador: atual.contador + 1, reiniciaEm: atual.reiniciaEm, novaJanela: false };
}

const chaveHash = (nome: string, valor: string) => `${nome}:${createHash("sha256").update(valor.toLowerCase()).digest("hex")}`;

/** Conta uma tentativa. `ok: false` quando o limite da janela já foi atingido. */
export async function consumir(nome: keyof typeof REGRAS, valor: string): Promise<Avaliacao> {
  const regra = REGRAS[nome];
  const chave = chaveHash(nome, valor);
  const atual = await db.limiteTaxa.findUnique({ where: { chave } });
  const r = avaliar(atual, regra);
  if (!r.ok) return r;
  if (r.novaJanela) {
    await db.limiteTaxa.upsert({
      where: { chave },
      create: { chave, contador: 1, reiniciaEm: r.reiniciaEm },
      update: { contador: 1, reiniciaEm: r.reiniciaEm },
    });
  } else {
    await db.limiteTaxa.update({ where: { chave }, data: { contador: { increment: 1 } } });
  }
  return r;
}

/** Zera o contador (ex.: depois de um login certo). */
export async function zerar(nome: keyof typeof REGRAS, valor: string) {
  await db.limiteTaxa.deleteMany({ where: { chave: chaveHash(nome, valor) } });
}

/** Remove janelas vencidas (chamado pela rotina periódica). */
export function limparVencidos(agora = new Date()) {
  return db.limiteTaxa.deleteMany({ where: { reiniciaEm: { lt: agora } } });
}

export function minutosPara(d: Date, agora = new Date()) {
  return Math.max(1, Math.ceil((d.getTime() - agora.getTime()) / 60000));
}

/** Mensagem padrão para quem estourou o limite. */
export function mensagemLimite(a: Avaliacao) {
  const m = minutosPara(a.reiniciaEm);
  return `Muitas tentativas. Tente de novo em ${m} ${m === 1 ? "minuto" : "minutos"}.`;
}

/**
 * IP do cliente. Atrás da Vercel (ou de outro proxy confiável) o x-forwarded-for é
 * reescrito pela plataforma; sem proxy, o cabeçalho pode ser forjado, então o
 * limite por e-mail/usuário continua sendo a proteção principal.
 */
export function ipDe(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "desconhecido";
}
