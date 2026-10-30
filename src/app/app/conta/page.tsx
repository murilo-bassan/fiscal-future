import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANOS, brl, plano, type PlanoId } from "@/lib/planos";
import { classificacoesNoMes } from "@/lib/uso";
import { ehPlanoPago, modoDemonstracao, stripeAtivo } from "@/lib/billing";
import { BarraUso } from "@/components/billing/BarraUso";
import { CartoesPlanos } from "@/components/billing/CartoesPlanos";
import { FormEscritorio } from "@/components/billing/FormEscritorio";

export const metadata: Metadata = { title: "Conta e plano" };

const ERROS: Record<string, string> = {
  plano: "Plano inválido. Escolha um dos planos abaixo.",
  config: "A cobrança deste plano ainda não está configurada. Fale com o suporte.",
  stripe: "Não conseguimos falar com o sistema de pagamento. Tente de novo em instantes.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ContaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const param = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]);

  const u = await exigirUsuario();
  const p = plano(u.plano);
  const [empresas, classificacoes, assinatura] = await Promise.all([
    db.empresa.count({ where: { userId: u.id } }),
    classificacoesNoMes(u.id),
    db.user.findUnique({ where: { id: u.id }, select: { stripeSubscriptionId: true } }),
  ]);

  const assinar = param("assinar");
  const destacar: PlanoId | null = ehPlanoPago(assinar) ? assinar : null;
  const demonstracao = modoDemonstracao();
  const semCobranca = !stripeAtivo() && !demonstracao;
  const erro = param("erro");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1.5">
        <h1 className="display text-2xl font-semibold text-ink sm:text-3xl">Conta e plano</h1>
        <p className="text-sm text-muted">{u.email}</p>
      </header>

      {demonstracao && (
        <div role="status" className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm text-ink">
          <strong>Modo demonstração.</strong> O Stripe não está configurado, então nenhum pagamento é cobrado: os
          botões trocam o plano na hora. Isso só funciona fora de produção.
        </div>
      )}
      {param("ok") === "1" && (
        <div role="status" className="rounded-xl bg-good-soft px-4 py-3 text-sm text-good">
          Pagamento recebido, obrigado! O novo plano é liberado em alguns segundos. Se não aparecer, recarregue a
          página.
        </div>
      )}
      {param("demo") === "1" && (
        <div role="status" className="rounded-xl bg-good-soft px-4 py-3 text-sm text-good">
          Plano trocado para <strong>{p.nome}</strong> (demonstração, sem cobrança).
        </div>
      )}
      {erro && (
        <div role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {ERROS[erro] ?? "Algo deu errado. Tente de novo."}
        </div>
      )}
      {destacar && destacar !== p.id && (
        <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">
          Você escolheu o plano <strong>{PLANOS[destacar].nome}</strong>. Confira abaixo e clique em{" "}
          {p.id === "gratis" ? "“Assinar”" : "“Trocar para este”"} para ir ao pagamento.
        </div>
      )}

      <section className="card grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Plano atual</p>
          <p className="display text-2xl font-semibold text-ink">{p.nome}</p>
          <p className="text-sm text-muted">
            {p.precoMensal > 0 ? `${brl(p.precoMensal)} por mês` : "Sem custo"} · {p.publico}
          </p>
          {u.stripeCustomerId && stripeAtivo() && (
            <form action="/api/portal" method="post" className="pt-2">
              <button className="btn-ghost">Gerenciar assinatura</button>
              <p className="hint">Trocar cartão, ver faturas ou cancelar.</p>
            </form>
          )}
          {demonstracao && p.id !== "gratis" && (
            <form action="/api/checkout" method="post" className="pt-2">
              <input type="hidden" name="plano" value="gratis" />
              <button className="btn-ghost">Voltar ao Grátis (demonstração)</button>
            </form>
          )}
        </div>
        <div className="space-y-4 self-center">
          <BarraUso rotulo="Empresas cadastradas" usados={empresas} limite={p.empresas} />
          <BarraUso rotulo="Classificações neste mês" usados={classificacoes} limite={p.classificacoesMes} />
        </div>
      </section>

      <section id="planos" className="scroll-mt-6 space-y-3">
        <h2 className="text-base font-semibold text-ink">{p.id === "gratis" ? "Assine um plano" : "Mudar de plano"}</h2>
        {semCobranca ? (
          <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
            As assinaturas estão indisponíveis no momento. Tente mais tarde.
          </p>
        ) : (
          <CartoesPlanos
            atual={p.id}
            destacar={destacar}
            demonstracao={demonstracao}
            temAssinatura={Boolean(assinatura?.stripeSubscriptionId)}
          />
        )}
        <p className="text-xs text-muted">
          Preços mensais em reais. Você pode cancelar quando quiser em “Gerenciar assinatura”.
        </p>
      </section>

      <section className="card max-w-2xl">
        <FormEscritorio valor={u.escritorio} editavel={p.marcaPropria} />
      </section>
    </div>
  );
}
