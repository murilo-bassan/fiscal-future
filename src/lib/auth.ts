import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "fiscalfuture_session";
/** Login pela metade: senha certa, falta o código de verificação em duas etapas. */
const COOKIE_2FA = "fiscalfuture_2fa";
const DURACAO_DIAS = 30;
const DURACAO_2FA_MIN = 10;

function chave() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto demais (mín. 32 caracteres)");
  return new TextEncoder().encode(s);
}

const opcoesCookie = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/** Cria a sessão. `v` é a sessaoVersao do usuário: se ela mudar, a sessão deixa de valer. */
export async function criarSessao(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sessaoVersao: true } });
  const token = await new SignJWT({ sub: userId, v: u.sessaoVersao })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave());
  const jar = await cookies();
  jar.set(COOKIE, token, opcoesCookie(DURACAO_DIAS * 24 * 60 * 60));
  jar.delete(COOKIE_2FA);
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

/** Invalida todas as sessões do usuário (troca de senha, "sair de todos os dispositivos"). */
export async function revogarSessoes(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessaoVersao: { increment: 1 } } });
}

export async function usuarioAtual() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const u = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nome: true,
        plano: true,
        escritorio: true,
        stripeCustomerId: true,
        totpAtivo: true,
        sessaoVersao: true,
      },
    });
    if (!u || u.sessaoVersao !== (payload.v ?? 0)) return null;
    return u;
  } catch {
    return null;
  }
}

/** Para páginas e actions da área logada. Redireciona se não houver sessão. */
export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  return u;
}

/** Guarda quem passou pela senha e ainda precisa do código. Vale 10 minutos. */
export async function criarDesafio2fa(userId: string) {
  const token = await new SignJWT({ sub: userId, etapa: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_2FA_MIN}m`)
    .sign(chave());
  (await cookies()).set(COOKIE_2FA, token, opcoesCookie(DURACAO_2FA_MIN * 60));
}

/** Id do usuário com login pela metade, ou null. */
export async function desafio2fa(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_2FA)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return payload.etapa === "2fa" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
