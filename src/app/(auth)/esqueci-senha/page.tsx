import type { Metadata } from "next";
import { EsqueciForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function EsqueciSenhaPage() {
  return (
    <>
      <h1 className="display text-3xl font-semibold text-ink">Esqueci a senha</h1>
      <p className="mt-2 text-sm text-muted">Mandamos um link para você criar uma senha nova.</p>
      <div className="card mt-6">
        <EsqueciForm />
      </div>
    </>
  );
}
