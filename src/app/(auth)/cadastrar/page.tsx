import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";
import { PLANOS, brl, type PlanoId } from "@/lib/planos";
import { CadastrarForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastrarPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string | string[] }>;
}) {
  const sp = await searchParams;
  const bruto = Array.isArray(sp.plano) ? sp.plano[0] : sp.plano;
  const escolhido = bruto && bruto in PLANOS ? PLANOS[bruto as PlanoId] : null;

  const u = await usuarioAtual();
  if (u) redirect(escolhido && escolhido.precoMensal > 0 ? `/app/conta?assinar=${escolhido.id}` : "/app");

  return (
    <>
      <h1 className="display text-3xl font-semibold text-ink">Criar conta</h1>
      <p className="mt-2 text-sm text-muted">
        {escolhido && escolhido.precoMensal > 0
          ? `Você escolheu o plano ${escolhido.nome} (${brl(escolhido.precoMensal)} por mês). Crie a conta e, em seguida, finalize a assinatura.`
          : "Grátis, sem cartão. Em 3 minutos você vê o impacto da reforma na sua empresa."}
      </p>
      <div className="card mt-6">
        <CadastrarForm plano={escolhido?.id} />
      </div>
    </>
  );
}
