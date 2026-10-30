import type { Metadata } from "next";
import Link from "next/link";
import { tokenValido } from "@/lib/senha";
import { RedefinirForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Criar senha nova", referrer: "no-referrer" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: SearchParams }) {
  const t = (await searchParams).token;
  const token = typeof t === "string" ? t : "";
  const valido = token ? Boolean(await tokenValido(token)) : false;

  return (
    <>
      <h1 className="display text-3xl font-semibold text-ink">Criar senha nova</h1>
      {valido ? (
        <div className="card mt-6">
          <RedefinirForm token={token} />
        </div>
      ) : (
        <div className="card mt-6 space-y-3">
          <p className="text-sm text-ink">Este link venceu ou já foi usado. Os links valem por 1 hora e funcionam uma vez só.</p>
          <Link href="/esqueci-senha" className="btn-primary">
            Pedir um link novo
          </Link>
        </div>
      )}
    </>
  );
}
