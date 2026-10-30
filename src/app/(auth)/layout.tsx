import Link from "next/link";
import { PERFIL_EXEMPLO, simular } from "@/lib/tax";
import { pctSinal } from "@/components/app/formato";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Um número real do motor, calculado com o perfil de exemplo, em vez de um slogan.
  const ex = simular(PERFIL_EXEMPLO);
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-5xl items-center px-4 py-5 sm:px-6">
        <Link href="/" className="display text-xl font-semibold text-ink">
          Fiscal Future
        </Link>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-4 sm:px-6 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-16 md:pt-10">
        <div>{children}</div>
        <aside className="hidden border-l border-line pl-10 md:block">
          <p className="text-sm text-muted">Um exemplo do que você vai ver</p>
          <p className="display mt-4 text-3xl leading-snug text-ink">
            Uma distribuidora no lucro presumido, com R$ 4,8 milhões de faturamento, precisa
            mudar o preço ao consumidor em{" "}
            <span className="whitespace-nowrap">{pctSinal(ex.resumo.reajusteNecessario2027)}</span> em
            2027 e{" "}
            <span className="whitespace-nowrap">{pctSinal(ex.resumo.reajusteNecessario2033)}</span> em
            2033 para manter o lucro de hoje.
          </p>
          <p className="mt-6 max-w-md text-sm text-muted">
            Você informa números que já tem na contabilidade. O Fiscal Future calcula, ano a ano, quanto a
            Reforma Tributária muda os seus impostos, o seu preço e o seu caixa.
          </p>
        </aside>
      </main>
    </div>
  );
}
