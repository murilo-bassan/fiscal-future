import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desafio2fa } from "@/lib/auth";
import { CodigoForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Código de verificação" };

export default async function CodigoPage() {
  if (!(await desafio2fa())) redirect("/entrar");
  return (
    <>
      <h1 className="display text-3xl font-semibold text-ink">Verificação em duas etapas</h1>
      <p className="mt-2 text-sm text-muted">Digite o código que aparece agora no seu aplicativo autenticador.</p>
      <div className="card mt-6">
        <CodigoForm />
      </div>
    </>
  );
}
