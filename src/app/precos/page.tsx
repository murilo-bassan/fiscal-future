import type { Metadata } from "next";
import Link from "next/link";
import { PLANOS, type Plano, type PlanoId } from "@/lib/planos";
import { Header, foco } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { Faq } from "@/components/marketing/Faq";
import { TabelaPrecos } from "@/components/marketing/TabelaPrecos";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Planos do ZeroAbi para simular o impacto da Reforma Tributária: grátis para começar, planos para PME, grupos de empresas e escritórios contábeis.",
};

const planos = Object.values(PLANOS);
const ordem = planos.map((p) => p.id);
/** Recurso disponível a partir de um plano (inclusive). */
const desde = (id: PlanoId) => (p: Plano) => ordem.indexOf(p.id) >= ordem.indexOf(id);
const numero = (v: number) => v.toLocaleString("pt-BR");

const comEmissao = planos.filter((p) => p.notasMes > 0);

const linhas: { recurso: string; valor: (p: Plano) => boolean | string }[] = [
  { recurso: "Empresas (CNPJs)", valor: (p) => numero(p.empresas) },
  { recurso: "Simulação de impacto 2026–2033", valor: () => true },
  { recurso: "Novo preço para manter a margem", valor: desde("essencial") },
  { recurso: "Simples puro ou híbrido", valor: desde("essencial") },
  { recurso: "Impacto do split payment no caixa", valor: desde("essencial") },
  { recurso: "Classificações de produtos por mês", valor: (p) => numero(p.classificacoesMes) },
  { recurso: "Classificação em lote (planilha CSV)", valor: (p) => p.classificacaoLote },
  { recurso: "Notas emitidas por mês (NF-e e NFS-e)", valor: (p) => (p.notasMes > 0 ? numero(p.notasMes) : false) },
  { recurso: "Notas antigas convertidas por mês", valor: (p) => numero(p.conversoesMes) },
  { recurso: "Cenários de alíquota lado a lado", valor: desde("profissional") },
  { recurso: "Relatório em PDF", valor: (p) => p.relatorioPdf },
  { recurso: "Relatório com a marca do escritório", valor: (p) => p.marcaPropria },
];

export default function PrecosPage() {
  return (
    <>
      <Header />
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
          <h1 className="display max-w-3xl text-[2.4rem] leading-[1.05] text-ink sm:text-6xl">
            Planos e preços
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Um estudo de impacto com consultoria custa de R$ 5 mil a R$ 30 mil e fica velho quando a
            alíquota muda. Aqui você refaz a conta quantas vezes precisar.
          </p>
          <div className="mt-10">
            <TabelaPrecos />
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="display text-3xl text-ink">Compare os recursos</h2>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">Recursos de cada plano</caption>
                <thead>
                  <tr className="border-b border-ink/80 text-left">
                    <th scope="col" className="py-3 pr-4 font-medium text-muted">
                      Recurso
                    </th>
                    {planos.map((p) => (
                      <th key={p.id} scope="col" className="px-3 py-3 text-center font-semibold text-ink">
                        {p.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.recurso} className="border-b border-line">
                      <th scope="row" className="py-3 pr-4 text-left font-normal text-ink">
                        {l.recurso}
                      </th>
                      {planos.map((p) => {
                        const v = l.valor(p);
                        return (
                          <td key={p.id} className="px-3 py-3 text-center">
                            {typeof v === "string" ? (
                              <span className="text-ink">{v}</span>
                            ) : v ? (
                              <span className="text-brand">
                                <span aria-hidden>✓</span>
                                <span className="sr-only">Incluído</span>
                              </span>
                            ) : (
                              <span className="text-muted">
                                <span aria-hidden>–</span>
                                <span className="sr-only">Não incluído</span>
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <h2 className="display text-3xl leading-tight text-ink">Perguntas sobre cobrança</h2>
            <Faq
              itens={[
                {
                  p: "Como funciona o plano anual?",
                  r: "Você paga 10 mensalidades e usa por 12 meses. A cobrança é feita uma vez, no início do período.",
                },
                {
                  p: "Posso trocar de plano depois?",
                  r: "Pode. Comece no Grátis para ver o tamanho do problema e mude quando precisar do novo preço, do relatório em PDF ou de mais empresas.",
                },
                {
                  p: "Posso cancelar quando quiser?",
                  r: "Sim, sem multa. O acesso continua até o fim do período que você já pagou.",
                },
                {
                  p: "A emissão de notas está incluída?",
                  r: `Sim, nos planos ${comEmissao.map((p) => p.nome).join(", ").replace(/, ([^,]*)$/, " e $1")}, com um limite mensal de notas por plano (veja a tabela acima). As notas já saem com IBS e CBS e são transmitidas por um emissor homologado.`,
                },
                {
                  p: "O que acontece quando a alíquota oficial sair?",
                  r: "Atualizamos os parâmetros e as suas simulações passam a usar o número oficial, sem custo extra. É justamente o que um estudo feito uma vez só não faz.",
                },
                {
                  p: "Sou contador. Como cobro dos meus clientes?",
                  r: `O plano ${PLANOS.contador.nome} atende até ${PLANOS.contador.empresas} clientes e gera relatórios com a marca do seu escritório. Você define quanto cobrar pelo estudo de impacto.`,
                },
              ]}
            />
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
            <p className="display max-w-xl text-2xl text-ink">
              Ainda em dúvida? Faça a primeira simulação no plano Grátis.
            </p>
            <Link href="/cadastrar?plano=gratis" className={`btn-primary px-5 py-3 text-base ${foco}`}>
              Simular grátis
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
