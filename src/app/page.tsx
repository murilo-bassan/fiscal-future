import Link from "next/link";
import {
  DEFAULT_CENARIO,
  PERFIL_EXEMPLO,
  PRESETS,
  TRANSICAO,
  aliquotasDoAno,
  compararSimples,
  impactoSplitPayment,
  simular,
} from "@/lib/tax";
import { PLANOS, brl, pct } from "@/lib/planos";
import { Header, foco } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { Faq } from "@/components/marketing/Faq";
import { converterNota, lerNota } from "@/lib/nfe";
import { XML_EXEMPLO } from "@/app/api/converter/_lib/exemplo";

/* ---------- números reais do exemplo, calculados pelo motor do app ---------- */

const sim = simular(PERFIL_EXEMPLO);
const ano = (a: number) => sim.anos.find((x) => x.ano === a)!;
const a2027 = ano(2027);
const a2033 = ano(2033);

const simples = compararSimples({ ...PERFIL_EXEMPLO, regime: "simples" });
const simples2027 = simples.anos.find((a) => a.ano === 2027)!;

const split = impactoSplitPayment({
  ibsCbsDebitoAnual: a2027.ibsCbsDebito,
  ibsCbsCreditoAnual: a2027.ibsCbsCredito,
  prazoMedioRecebimentoDias: PERFIL_EXEMPLO.prazoMedioRecebimentoDias,
});

const favoravel = sim.resumo.variacaoCarga2027 < 0;

const refTotal = DEFAULT_CENARIO.cbs + DEFAULT_CENARIO.ibs;
const cgibs = PRESETS.find((p) => p.id === "cgibs-2026") ?? PRESETS[PRESETS.length - 1];

/** R$ 691 mil, R$ 21,9 mil */
function mil(v: number) {
  const m = Math.abs(v) / 1000;
  const casas = m >= 100 ? 0 : 1;
  return `R$ ${m.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} mil`;
}
const milhoes = (v: number) =>
  `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} milhões`;
const variacao = (v: number) => `${v > 0 ? "+" : "−"}${pct(Math.abs(v))}`;

const regimeNome = { simples: "Simples Nacional", presumido: "lucro presumido", real: "lucro real" };
const atividadeNome = { comercio: "Comércio", industria: "Indústria", servicos: "Serviços" };

/* ---------------------------------- página ---------------------------------- */

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <LinhaDoTempo />
        <Dores />
        <NotasNoModeloNovo />
        <ParaQuem />
        <PrevisaoPrecos />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  const linhas = [ano(2026), a2027, a2033];
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-24">
        <div>
          <h1 className="display text-[2.1rem] leading-[1.08] font-normal text-ink sm:text-5xl lg:text-6xl">
            Saiba quanto a reforma vai custar para a sua empresa e quanto cobrar a partir de
            janeiro.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Em 1º de janeiro de 2027 o PIS e a Cofins acabam e a CBS entra inteira. O ZeroAbi
            calcula, com os números da sua empresa, o imposto de cada ano até 2033, o preço que
            mantém a sua margem e o efeito no caixa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/cadastrar" className={`btn-primary px-5 py-3 text-base ${foco}`}>
              Simular grátis
            </Link>
            <Link href="/precos" className={`btn-ghost px-5 py-3 text-base ${foco}`}>
              Ver preços
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            O plano Grátis já inclui {PLANOS.gratis.empresas} empresa e a simulação de 2026 a 2033.
          </p>
        </div>

        {/* Extrato de exemplo: saída real do motor de cálculo */}
        <figure className="self-start rounded-sm border border-line bg-surface shadow-[0_1px_0_var(--line),0_12px_32px_-20px_var(--ink)]">
          <div className="border-b border-line px-5 py-4 sm:px-6">
            <p className="display text-lg text-ink">{PERFIL_EXEMPLO.nome}</p>
            <p className="mt-0.5 text-sm text-muted">
              {atividadeNome[PERFIL_EXEMPLO.atividade]}, {regimeNome[PERFIL_EXEMPLO.regime]},
              faturamento de {milhoes(PERFIL_EXEMPLO.receitaAnual)} por ano
            </p>
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Tributos sobre vendas e preço para manter o lucro, por ano
            </caption>
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="px-5 pt-4 pb-2 font-medium sm:px-6">
                  Ano
                </th>
                <th scope="col" className="px-2 pt-4 pb-2 text-right font-medium">
                  Tributos sobre vendas
                </th>
                <th scope="col" className="px-5 pt-4 pb-2 text-right font-medium sm:px-6">
                  Preço que mantém o lucro
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.ano} className="border-t border-line">
                  <th scope="row" className="display px-5 py-3 text-left text-xl font-normal sm:px-6">
                    {l.ano}
                  </th>
                  <td className="px-2 py-3 text-right text-ink">{mil(l.cargaTotal)}</td>
                  <td className="px-5 py-3 text-right sm:px-6">
                    {l.ano === 2026 ? (
                      <span className="text-muted">preço de hoje</span>
                    ) : (
                      <span className={l.precoConsumidorIndice > 1 ? "text-bad" : "text-good"}>
                        {variacao(l.precoConsumidorIndice - 1)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="border-t border-line px-5 py-3 text-xs leading-relaxed text-muted sm:px-6">
            Empresa fictícia, calculada pelo mesmo motor do app no cenário “{DEFAULT_CENARIO.nome}”.
            {favoravel
              ? "Nesta empresa a conta é favorável; em outra pode ser o contrário."
              : "Nesta empresa a conta é desfavorável; em outra pode ser o contrário."}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function LinhaDoTempo() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">
            Oito anos de transição, dois sistemas ao mesmo tempo
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Até 2033 a sua empresa convive com o imposto antigo e o novo. As barras mostram quanto
            de cada um está valendo em cada ano. A alíquota de IBS e CBS usa a estimativa do
            governo, de cerca de {pct(refTotal)} somados; o Comitê Gestor do IBS projetou{" "}
            {pct(cgibs.cbs + cgibs.ibs, 2)}.
          </p>
        </div>

        <ol className="mt-12 border-t border-ink/80">
          {TRANSICAO.map((f) => {
            const { total } = aliquotasDoAno(f, DEFAULT_CENARIO);
            const virada = f.ano === 2027 || f.ano === 2033;
            return (
              <li
                key={f.ano}
                className="grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-3 border-b border-line py-5 md:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-8"
              >
                <p
                  className={`display row-span-2 text-3xl leading-none md:row-span-1 md:text-4xl ${virada ? "text-brand" : "text-ink"}`}
                >
                  {f.ano}
                </p>
                <div className="space-y-2.5">
                  <Medidor
                    rotulo="ICMS e ISS"
                    fracao={f.icmsIss}
                    valor={f.icmsIss === 0 ? "extintos" : `${Math.round(f.icmsIss * 100)}% do atual`}
                    cor="bg-muted"
                  />
                  <Medidor
                    rotulo="CBS e IBS"
                    fracao={total / refTotal}
                    valor={f.ibsCbsCompensavel ? `${pct(total)}, de teste` : pct(total)}
                    cor="bg-brand"
                  />
                </div>
                <p className="col-start-2 text-sm leading-relaxed text-muted md:col-start-3">
                  {f.nota}
                  {f.ano === 2026 && " O Senado fixa a alíquota da CBS até 15/12/2026."}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Medidor({
  rotulo,
  fracao,
  valor,
  cor,
}: {
  rotulo: string;
  fracao: number;
  valor: string;
  cor: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted">{rotulo}</span>
        <span className="font-medium text-ink">{valor}</span>
      </div>
      <div className="mt-1 h-2 bg-line" aria-hidden>
        <div
          className={`h-full ${cor}`}
          style={{ width: `${Math.max(0, Math.min(1, fracao)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Dores() {
  const dores = [
    {
      pergunta: "Quanto vou pagar de imposto em cada ano?",
      numero: `${mil(sim.cargaAtual)} → ${mil(a2027.cargaTotal)}`,
      legenda: "tributos sobre vendas da distribuidora, de hoje para 2027",
      texto: `${favoravel ? "Com crédito sobre quase tudo que compra, a carga da distribuidora cai" : "A carga da distribuidora sobe"} ${pct(Math.abs(sim.resumo.variacaoCarga2027))} em 2027 e ${pct(Math.abs(sim.resumo.variacaoCarga2033))} em 2033. Em outra empresa a conta pode ir para o outro lado. O ZeroAbi faz a conta ano a ano, de 2026 a 2033, comparando o regime atual com o novo.`,
    },
    {
      pergunta: "Que preço eu cobro a partir de janeiro?",
      numero: variacao(sim.resumo.reajusteNecessario2027),
      legenda: "ajuste no preço final que mantém o lucro da distribuidora em 2027",
      texto: `Em 2033 o ajuste chega a ${variacao(sim.resumo.reajusteNecessario2033)}. Quando a conta é desfavorável e você não repassa, a diferença sai do lucro. O ZeroAbi mostra o novo preço e quanto de lucro se perde se o preço ficar como está.`,
    },
    {
      pergunta: "Continuo só no Simples ou recolho IBS e CBS por fora?",
      numero: `${pct(simples2027.creditoClienteHoje)} → ${pct(simples2027.creditoClientePuro)}`,
      legenda: "crédito que o cliente PJ aproveita, se a mesma empresa fosse do Simples",
      texto: `Quem fica só no DAS transfere pouco crédito, e o cliente empresa passa a ter motivo para trocar de fornecedor. Na mesma empresa, o Simples híbrido compensa a partir de ${simples.pontoDeVirada2033 !== null ? pct(simples.pontoDeVirada2033) : "uma certa fatia"} das vendas para empresas${simples.ganhoAnualHibrido2027 > 0 ? `, e renderia ${mil(simples.ganhoAnualHibrido2027)} a mais de lucro em 2027` : ""}. A opção é semestral, então dá para revisar.`,
    },
    {
      pergunta: "Quanto de caixa eu perco com o split payment?",
      numero: `até ${mil(split.capitalGiroSimplificado)}`,
      legenda: "de capital de giro extra para a distribuidora em 2027",
      texto: `Com o split payment, o imposto é retido na hora do Pix, do cartão ou do boleto. Acaba a folga entre receber e recolher, que hoje é de ${split.folgaAtualDias} dias nessa empresa. Dependendo do modelo de retenção, o impacto fica entre ${mil(split.capitalGiroInteligente)} e ${mil(split.capitalGiroSimplificado)}.`,
    },
  ];

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">
            As quatro perguntas que todo dono de empresa está fazendo
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Os números abaixo são da {PERFIL_EXEMPLO.nome}, a mesma empresa do quadro lá em cima.
            No app, você troca pelos seus.
          </p>
        </div>

        <div className="mt-12 grid gap-x-12 md:grid-cols-2">
          {dores.map((d) => (
            <article key={d.pergunta} className="border-t border-ink/80 pt-6 pb-12">
              <h3 className="text-lg font-semibold text-ink">{d.pergunta}</h3>
              <p className="display mt-5 text-3xl leading-tight text-brand sm:text-4xl lg:text-5xl">
                {d.numero}
              </p>
              <p className="mt-2 text-sm text-muted">{d.legenda}</p>
              <p className="mt-5 leading-relaxed text-ink/85">{d.texto}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 border-t border-line pt-8 text-sm leading-relaxed text-muted md:grid-cols-2 md:gap-12">
          <p>
            <span className="font-semibold text-ink">Classificação dos seus produtos por IA.</span>{" "}
            Descreva o item e o ZeroAbi indica se ele paga a alíquota padrão, tem redução de 30% ou
            60%, ou alíquota zero, como os itens da cesta básica.
          </p>
          <p>
            <span className="font-semibold text-ink">Relatório em PDF.</span> Tudo isso num
            documento para levar à reunião com sócios, banco ou clientes. No plano do escritório
            contábil, com a marca do escritório.
          </p>
        </div>
      </div>
    </section>
  );
}

function NotasNoModeloNovo() {
  // Conversão real da nota de exemplo do app, feita pelo mesmo conversor
  const conv = converterNota(lerNota(XML_EXEMPLO), { ano: 2027 });
  const primeiroComEmissao = Object.values(PLANOS).find((p) => p.notasMes > 0);
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="display max-w-2xl text-3xl leading-tight text-ink sm:text-4xl">
          Emita e converta notas no modelo novo
        </h2>
        <div className="mt-10 grid gap-12 md:grid-cols-2">
          <article className="border-t border-ink/80 pt-6">
            <h3 className="text-lg font-semibold text-ink">Emissão de NF-e e NFS-e já com IBS e CBS</h3>
            <p className="mt-4 leading-relaxed text-ink/85">
              O ZeroAbi preenche o CST, o cClassTrib e os valores de IBS e CBS de cada item a partir
              da classificação dos seus produtos e serviços. A NFS-e nacional passa a ser obrigatória
              para o Simples em 1º de novembro de 2026, e a partir de 1º de janeiro de 2027 o Simples
              também precisa preencher os campos de IBS e CBS na NF-e.
            </p>
            {primeiroComEmissao && (
              <p className="mt-4 text-sm text-muted">
                Incluída a partir do plano {primeiroComEmissao.nome}, com limite mensal de notas.
              </p>
            )}
          </article>
          <article className="border-t border-ink/80 pt-6">
            <h3 className="text-lg font-semibold text-ink">Conversão das notas que você já emitiu</h3>
            <p className="mt-4 leading-relaxed text-ink/85">
              Envie o XML de uma nota antiga e veja como ela fica no modelo novo: a classificação de
              cada item, o imposto da mesma venda no ano que você escolher e o XML no layout novo,
              para ajustar o cadastro do ERP antes da virada.
            </p>
            <div className="mt-5 border-y border-line py-4">
              <p className="text-sm text-muted">
                Nota de exemplo com {conv.itens.length} itens, tributos sobre a venda
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 text-ink">
                <span className="display text-2xl text-muted">{brl(conv.totais.tributosOriginais, 2)}</span>
                <span aria-hidden className="text-muted">→</span>
                <span className="sr-only">passam a</span>
                <span className="display text-2xl">{brl(conv.totais.totalNoAno, 2)}</span>
                <span className="text-sm text-muted">em {conv.ano}</span>
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function ParaQuem() {
  const publicos = [
    {
      titulo: "Dono de pequena e média empresa",
      texto:
        "Você precisa decidir preço, contrato e caixa para 2027 agora, sem esperar o estudo da consultoria. Responde algumas perguntas sobre faturamento e compras e vê o resultado na hora.",
    },
    {
      titulo: "Empresa do Simples que vende para empresas",
      texto:
        "Seu cliente PJ vai olhar quanto crédito leva ao comprar de você. O ZeroAbi mostra se vale continuar só no DAS ou recolher IBS e CBS por fora, e a partir de que fatia de vendas a empresas a troca compensa.",
    },
    {
      titulo: "Escritório contábil",
      texto:
        "Seus clientes vão perguntar o que muda. Simule a carteira inteira, gere relatórios com a marca do escritório e transforme a reforma em um serviço que você cobra.",
    },
  ];
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="display max-w-2xl text-3xl leading-tight text-ink sm:text-4xl">
          Para quem é
        </h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-12">
          {publicos.map((p) => (
            <div key={p.titulo}>
              <h3 className="display text-xl text-ink">{p.titulo}</h3>
              <p className="mt-3 leading-relaxed text-muted">{p.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrevisaoPrecos() {
  const lista = Object.values(PLANOS);
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">
            Menos que uma hora de consultoria
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            Um estudo de impacto com consultoria custa de R$ 5 mil a R$ 30 mil e fica velho quando a
            alíquota muda. No ZeroAbi, você refaz a conta sempre que sair um número novo.
          </p>
          <Link href="/precos" className={`btn-ghost mt-6 ${foco}`}>
            Comparar planos
          </Link>
        </div>
        <ul className="divide-y divide-line border-y border-line">
          {lista.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-4 py-4">
              <div>
                <p className="font-semibold text-ink">{p.nome}</p>
                <p className="text-sm text-muted">{p.publico}</p>
              </div>
              <p className="shrink-0 text-right text-ink">
                {p.precoMensal === 0 ? (
                  <span className="display text-2xl">Grátis</span>
                ) : (
                  <>
                    <span className="display text-2xl">{brl(p.precoMensal)}</span>
                    <span className="text-sm text-muted">/mês</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Perguntas() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <h2 className="display text-3xl leading-tight text-ink sm:text-4xl">Perguntas frequentes</h2>
        <Faq
          itens={[
            {
              p: "Isso substitui meu contador?",
              r: "Não. O ZeroAbi é uma ferramenta de estimativa, e funciona melhor nas mãos do contador. Ele confere os dados de entrada, valida a classificação dos produtos e decide com você. Por isso existe um plano feito para escritórios contábeis.",
            },
            {
              p: "De onde vêm as alíquotas, se elas ainda não foram definidas?",
              r: `Usamos a estimativa do governo, de cerca de ${pct(refTotal)} de IBS e CBS somados, e a projeção do Comitê Gestor do IBS, de ${pct(cgibs.cbs + cgibs.ibs, 2)}. Você escolhe o cenário. O Senado fixa a alíquota da CBS até 15/12/2026; quando sair, atualizamos e a sua simulação é refeita com o número oficial.`,
            },
            {
              p: "Sou do Simples. A reforma me afeta?",
              r: "Se você vende para consumidor final, muda pouco. Se vende para outras empresas, muda bastante: quem compra de uma empresa no regime regular credita todo o IBS e a CBS, e de quem fica só no DAS credita pouco. O ZeroAbi compara as duas opções com os seus números.",
            },
            {
              p: "O que é split payment?",
              r: "É a retenção do imposto no momento do pagamento. Quando o cliente paga por Pix, cartão ou boleto, a parte do IBS e da CBS vai direto para o governo. Você deixa de ficar com esse dinheiro em caixa até a data de recolher a guia.",
            },
            {
              p: "Minha empresa tem redução de alíquota?",
              r: "Pode ter. Saúde, educação, alimentos e insumos agropecuários, entre outros, têm redução de 60%; profissões regulamentadas, de 30%; itens da cesta básica têm alíquota zero. A classificação por IA indica a categoria de cada produto ou serviço, e o seu contador confirma.",
            },
            {
              p: "O que vocês fazem com os dados da minha empresa?",
              r: (
                <>
                  Usamos só para fazer a simulação. Não vendemos nem compartilhamos para outros fins.
                  Os detalhes estão na{" "}
                  <Link href="/privacidade" className={`text-brand underline ${foco}`}>
                    política de privacidade
                  </Link>
                  .
                </>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="display max-w-3xl text-3xl leading-tight sm:text-5xl">
          O preço de janeiro se decide agora.
        </h2>
        <dl className="mt-10 grid max-w-3xl gap-6 border-t border-paper/25 pt-6 sm:grid-cols-2">
          <div>
            <dt className="display text-2xl">15 de dezembro de 2026</dt>
            <dd className="mt-1 text-paper/70">Prazo para o Senado fixar a alíquota da CBS.</dd>
          </div>
          <div>
            <dt className="display text-2xl">1º de janeiro de 2027</dt>
            <dd className="mt-1 text-paper/70">
              PIS e Cofins acabam, o IPI zera e a CBS passa a ser cobrada inteira.
            </dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/cadastrar"
            className="btn bg-paper px-5 py-3 text-base text-ink hover:bg-paper/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
          >
            Simular grátis
          </Link>
          <p className="text-sm text-paper/70">Faça a primeira simulação hoje e refaça quando a alíquota sair.</p>
        </div>
      </div>
    </section>
  );
}
