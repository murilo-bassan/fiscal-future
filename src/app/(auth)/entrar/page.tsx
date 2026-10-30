import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { EntrarForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EntrarPage({ searchParams }: { searchParams: SearchParams }) {
  if (await usuarioAtual()) redirect("/app");
  const redefinida = (await searchParams).redefinida === "1";
  return (
    <>
      <h1 className="display text-3xl font-semibold text-ink">Entrar</h1>
      <p className="mt-2 text-sm text-muted">Use o e-mail e a senha que você cadastrou.</p>
      <div className="card mt-6">
        <EntrarForm aviso={redefinida ? "Senha nova salva. Entre com ela." : undefined} />
      </div>
    </>
  );
}
