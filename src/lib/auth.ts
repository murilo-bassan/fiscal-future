import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "fiscalfuture_session";
const DURACAO_DIAS = 30;

function chave() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto demais (mín. 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function criarSessao(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(chave());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}

export async function usuarioAtual() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave());
    if (!payload.sub) return null;
    return db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, nome: true, plano: true, escritorio: true, stripeCustomerId: true },
    });
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
