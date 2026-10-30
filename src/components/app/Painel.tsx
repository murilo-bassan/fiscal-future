/**
 * Blocos do painel de resultado. Server components, reaproveitados no relatório.
 */

import { CREDITO_FORNECEDOR_SIMPLES, REDUCOES, SELIC_ANUAL } from "@/lib/tax";
import type { Analise } from "./analise";
import { respostas } from "./analise";
import { NOMES_ATIVIDADE, NOMES_REGIME } from "./camposPerfil";
import { brl, brlSinal, pct, pctSinal } from "./formato";
import { GraficoCarga, GraficoLinha } from "./Graficos";

/* ------------------------------------------------------------------ */

export function Resposta({ a, compacto = false }: { a: Analise; compacto?: boolean }) {
  const r = respostas(a);
  return (
    <section aria-labelledby="resposta">
      <h2
        id="resposta"
        className={`display max-w-[34ch] font-medium leading-tight text-ink ${
          compacto ? "text-2xl" : "text-[1.7rem] sm:text-4xl"
        }`}
      >
        {r.titulo}
      </h2>
      <div className="mt-4 max-w-[68ch] space-y-2 text-base text-ink/85">
        {r.frases.map((f) => (
          <p key={f}>{f}</p>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

type Kpi = {
  rotulo: string;
  valor: string;
  detalhe?: string;
  /** Direção do efeito para o dono: "ruim" pinta de --bad, "bom" de --good. */
  efeito?: "bom" | "ruim" | null;
};

function efeitoDe(v: number, subirEhRuim: boolean): Kpi["efeito"] {
  if (Math.abs(v) < 0.0005) return null;
  return v > 0 === subirEhRuim ? "ruim" : "bom";
}

export function Kpis({ a }: { a: Analise }) {
  const { sim, a27, a33, comparacao } = a;
  const R = a.perfil.receitaAnual;
  let itens: Kpi[];
  if (a.simples && comparacao) {
    const c27 = comparacao.anos.find((x) => x.ano === 2027)!;
    itens = [
      { rotulo: "DAS por ano, hoje", valor: brl(sim.cargaAtual), detalhe: `${pct(sim.cargaAtual / R)} do faturamento` },
      { rotulo: "Lucro anual estimado", valor: brl(sim.lucroAtual), detalhe: "Igual até 2033 no Simples puro" },
      {
        rotulo: "Híbrido × puro em 2027",
        valor: brlSinal(comparacao.ganhoAnualHibrido2027),
        detalhe: comparacao.recomendacao2027 === "hibrido" ? "por ano a favor do híbrido" : "por ano: o puro é melhor",
        efeito: null,
      },
      {
        rotulo: "Híbrido × puro em 2033",
        valor: brlSinal(comparacao.ganhoAnualHibrido2033),
        detalhe: comparacao.recomendacao2033 === "hibrido" ? "por ano a favor do híbrido" : "por ano: o puro é melhor",
        efeito: null,
      },
      {
        rotulo: "Crédito do seu cliente PJ",
        valor: `${pct(c27.creditoClienteHoje)} → ${pct(c27.creditoClientePuro)}`,
        detalhe: "hoje × 2027 no Simples puro",
        efeito: c27.creditoClientePuro < c27.creditoClienteHoje ? "ruim" : null,
      },
    ];
  } else {
    const r = sim.resumo;
    itens = [
      { rotulo: "Impostos sobre consumo hoje", valor: brl(sim.cargaAtual), detalhe: `${pct(sim.cargaAtual / R)} do faturamento` },
      {
        rotulo: "Em 2027",
        valor: brl(a27.cargaTotal),
        detalhe: `${pctSinal(r.variacaoCarga2027)} sobre hoje`,
        efeito: efeitoDe(r.variacaoCarga2027, true),
      },
      {
        rotulo: "Em 2033",
        valor: brl(a33.cargaTotal),
        detalhe: `${pctSinal(r.variacaoCarga2033)} sobre hoje`,
        efeito: efeitoDe(r.variacaoCarga2033, true),
      },
      {
        rotulo: "Reajuste de preço necessário",
        valor: pctSinal(r.reajusteNecessario2033),
        detalhe: `em 2033 (${pctSinal(r.reajusteNecessario2027)} em 2027)`,
        efeito: efeitoDe(r.reajusteNecessario2033, true),
      },
      {
        rotulo: "Lucro em 2033 sem repassar",
        valor: brl(a33.lucroSemRepasse),
        detalhe: `${pctSinal(r.variacaoLucroSemRepasse2033)} sobre ${brl(sim.lucroAtual)} de hoje`,
        efeito: efeitoDe(r.variacaoLucroSemRepasse2033, false),
      },
    ];
  }

  return (
    <dl className="grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-5">
      {itens.map((k, i) => (
        <div key={k.rotulo} className={`bg-paper py-4 pr-3 ${i % 2 === 1 ? "pl-4" : ""} lg:pl-4 lg:first:pl-0 ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
          <dt className="text-xs text-muted">{k.rotulo}</dt>
          <dd className="mt-1 text-xl font-semibold text-ink sm:text-2xl" style={{ fontVariantNumeric: "tabular-nums" }}>
            {k.valor}
          </dd>
          {k.detalhe && (
            <dd
              className={`mt-0.5 text-xs ${
                k.efeito === "ruim" ? "text-bad" : k.efeito === "bom" ? "text-good" : "text-muted"
              }`}
            >
              {k.detalhe}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */

export function BlocoGraficos({ a, impressao = false }: { a: Analise; impressao?: boolean }) {
  const { sim, comparacao } = a;
  const anos = sim.anos.map((x) => x.ano);
  const carga = (
    <GraficoCarga
      titulo="Impostos sobre consumo por ano"
      nomeAntigos={a.simples ? "DAS (Simples puro)" : "Tributos atuais (ICMS, ISS, PIS/Cofins, IPI)"}
      nomeNovo="IBS/CBS líquido (débito menos crédito)"
      dados={sim.anos.map((x) => ({ ano: x.ano, antigos: x.tributosAntigos, novo: x.ibsCbsLiquido }))}
    />
  );
  const segundo =
    a.simples && comparacao ? (
      <GraficoLinha
        titulo="Lucro anual: Simples puro × híbrido"
        anos={comparacao.anos.map((x) => x.ano)}
        formato="brl"
        series={[
          { nome: "Simples puro", tom: "muted", valores: comparacao.anos.map((x) => x.lucroPuro) },
          { nome: "Simples híbrido", tom: "brand", valores: comparacao.anos.map((x) => x.lucroHibrido) },
        ]}
      />
    ) : (
      <GraficoLinha
        titulo="Preço ao consumidor para manter o lucro"
        anos={anos}
        formato="pctSinal"
        referencia={0}
        rotuloReferencia="Preço de hoje"
        series={[{ nome: "Variação do preço", tom: "brand", valores: sim.anos.map((x) => x.precoConsumidorIndice - 1) }]}
      />
    );
  return (
    <div className={`grid gap-8 ${impressao ? "" : "lg:grid-cols-2"}`}>
      <div className={impressao ? "break-inside-avoid" : "card"}>{carga}</div>
      <div className={impressao ? "break-inside-avoid" : "card"}>
        {segundo}
        {a.simples && (
          <p className="mt-3 text-xs text-muted">
            No Simples puro o preço ao consumidor não precisa mudar: o DAS continua o mesmo. No híbrido,
            o preço para clientes empresa cai e o IBS/CBS é cobrado por fora.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const thBase = "px-3 py-2 font-medium text-muted whitespace-nowrap";
const th = `${thBase} text-right`;
const td = "px-3 py-2 text-right whitespace-nowrap";

export function TabelaAnos({ a }: { a: Analise }) {
  const { sim, comparacao } = a;
  if (a.simples && comparacao) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Comparação ano a ano entre Simples puro e híbrido</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={`${thBase} text-left`}>Ano</th>
              <th scope="col" className={th}>Lucro no puro</th>
              <th scope="col" className={th}>Lucro no híbrido</th>
              <th scope="col" className={th}>Diferença</th>
              <th scope="col" className={th}>DAS no híbrido</th>
              <th scope="col" className={th}>IBS/CBS no híbrido</th>
              <th scope="col" className={th}>Crédito do cliente PJ (puro)</th>
            </tr>
          </thead>
          <tbody>
            {comparacao.anos.map((x) => (
              <tr key={x.ano} className="border-b border-line/70">
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-semibold text-ink">{x.ano}</th>
                <td className={td}>{brl(x.lucroPuro)}</td>
                <td className={td}>{brl(x.lucroHibrido)}</td>
                <td className={`${td} font-semibold`}>{brlSinal(x.lucroHibrido - x.lucroPuro)}</td>
                <td className={td}>{brl(x.dasHibrido)}</td>
                <td className={td}>{brl(x.ibsCbsLiquidoHibrido)}</td>
                <td className={td}>{pct(x.creditoClientePuro)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">Resultado ano a ano</caption>
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={`${thBase} text-left`}>Ano</th>
            <th scope="col" className={th}>Alíquota IBS/CBS</th>
            <th scope="col" className={th}>Tributos atuais</th>
            <th scope="col" className={th}>IBS/CBS débito</th>
            <th scope="col" className={th}>IBS/CBS crédito</th>
            <th scope="col" className={th}>Carga total</th>
            <th scope="col" className={th}>Preço ao consumidor</th>
            <th scope="col" className={th}>Lucro sem repasse</th>
            <th scope="col" className={th}>Custo do cliente PJ</th>
          </tr>
        </thead>
        <tbody>
          {sim.anos.map((x) => (
            <tr key={x.ano} className="border-b border-line/70" title={x.nota}>
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-semibold text-ink">
                {x.ano}
                {x.ano === 2026 && <span className="ml-1 font-normal text-muted">(teste)</span>}
              </th>
              <td className={td}>{pct(x.aliquotaIbsCbs)}</td>
              <td className={td}>{brl(x.tributosAntigos)}</td>
              <td className={td}>{brl(x.ibsCbsDebito)}</td>
              <td className={td}>{brl(x.ibsCbsCredito)}</td>
              <td className={`${td} font-semibold`}>{brl(x.cargaTotal)}</td>
              <td className={td}>{pctSinal(x.precoConsumidorIndice - 1)}</td>
              <td className={td}>{brl(x.lucroSemRepasse)}</td>
              <td className={td}>{pctSinal(x.custoClientePJIndice - 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-3 pb-2 text-xs text-muted">
        Em 2026 a CBS (0,9%) e o IBS (0,1%) são destacados na nota, mas compensados com PIS/Cofins: custo
        zero. Preço ao consumidor e custo do cliente PJ são variações sobre o valor de hoje.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function SecaoSimples({ a }: { a: Analise }) {
  const c = a.comparacao;
  if (!c) return null;
  const c27 = c.anos.find((x) => x.ano === 2027)!;
  const c33 = c.anos.find((x) => x.ano === 2033)!;
  const nome = (r: "puro" | "hibrido") => (r === "puro" ? "Ficar no Simples puro" : "Optar pelo Simples híbrido");

  const virada =
    c.pontoDeVirada2033 === null
      ? "Com os seus números, o híbrido não compensa em 2033 nem se 100% das vendas forem para empresas."
      : c.pontoDeVirada2033 === 0
        ? "Com os seus números, o híbrido compensa em 2033 mesmo sem vendas para empresas."
        : `O híbrido passa a compensar em 2033 quando mais de ${pct(c.pontoDeVirada2033)} da receita vem de empresas. Hoje você está em ${pct(a.perfil.percentualB2B)}.`;

  return (
    <section aria-labelledby="titulo-simples" className="break-inside-avoid">
      <h2 id="titulo-simples" className="display text-2xl font-semibold text-ink">
        Simples puro ou híbrido?
      </h2>
      <p className="mt-2 max-w-[68ch] text-sm text-muted">
        A partir de 2027, quem está no Simples pode continuar pagando tudo no DAS (puro) ou recolher IBS e
        CBS por fora, no regime regular (híbrido). No híbrido seus clientes empresa aproveitam crédito
        integral; no puro, só o pouco que está dentro do DAS.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {[
          { ano: 2027, rec: c.recomendacao2027, ganho: c.ganhoAnualHibrido2027 },
          { ano: 2033, rec: c.recomendacao2033, ganho: c.ganhoAnualHibrido2033 },
        ].map((r) => (
          <div key={r.ano} className={`rounded-xl border p-5 ${r.rec === "hibrido" ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
            <p className="text-sm text-muted">Em {r.ano}</p>
            <p className="display mt-1 text-xl font-semibold text-ink">{nome(r.rec)}</p>
            <p className="mt-2 text-sm text-ink">
              <span className="font-semibold tabular-nums">{brl(Math.abs(r.ganho))}</span> por ano a mais de
              lucro do que {r.rec === "hibrido" ? "no puro" : "no híbrido"}.
            </p>
          </div>
        ))}
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-line py-4">
        <div>
          <dt className="text-xs text-muted">Crédito do cliente PJ hoje</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{pct(c27.creditoClienteHoje)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">No puro, em 2027</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{pct(c27.creditoClientePuro)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">No puro, em 2033</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{pct(c33.creditoClientePuro)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted">
        Quanto um cliente do lucro real recupera em impostos a cada R$ 100 que compra de você. No híbrido,
        ele recupera todo o IBS/CBS destacado.
      </p>

      <h3 className="mt-6 text-base font-semibold text-ink">Por quê</h3>
      <ul className="mt-2 max-w-[68ch] list-disc space-y-1.5 pl-5 text-sm text-ink">
        {c.explicacao.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      <p className="mt-4 max-w-[68ch] rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink">{virada}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function SecaoSplit({ a }: { a: Analise }) {
  const s = a.split;
  if (!s) return null;
  const prazo = a.perfil.prazoMedioRecebimentoDias;
  const folga = s.a27.folgaAtualDias;
  const linhas = [
    {
      nome: "Split inteligente",
      dica: "retém só o imposto líquido (débito menos créditos)",
      g27: s.a27.capitalGiroInteligente,
      g33: s.a33.capitalGiroInteligente,
      c27: s.a27.custoFinanceiroAnualInteligente,
      c33: s.a33.custoFinanceiroAnualInteligente,
    },
    {
      nome: "Split simplificado",
      dica: "retém o débito cheio e devolve o crédito depois",
      g27: s.a27.capitalGiroSimplificado,
      g33: s.a33.capitalGiroSimplificado,
      c27: s.a27.custoFinanceiroAnualSimplificado,
      c33: s.a33.custoFinanceiroAnualSimplificado,
    },
  ];
  return (
    <section aria-labelledby="titulo-split" className="break-inside-avoid">
      <h2 id="titulo-split" className="display text-2xl font-semibold text-ink">
        Split payment: o efeito no caixa
      </h2>
      <p className="mt-2 max-w-[68ch] text-sm text-ink/85">
        {folga > 0
          ? `Hoje você recebe as vendas em cerca de ${prazo} dias e só recolhe o imposto uns 40 dias depois da venda: são ${folga} dias usando esse dinheiro como capital de giro. Com o split payment, o IBS/CBS é retido no momento do pagamento (Pix, cartão, boleto) e essa folga acaba.`
          : `Você recebe as vendas em cerca de ${prazo} dias, depois do vencimento do imposto. Com o split payment o imposto só sai quando o dinheiro entra, o que pode até aliviar o seu caixa.`}
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Capital de giro adicional e custo financeiro por modelo de split payment</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={`${thBase} text-left`}>Modelo</th>
              <th scope="col" className={th}>Caixa extra em 2027</th>
              <th scope="col" className={th}>Custo por ano</th>
              <th scope="col" className={th}>Caixa extra em 2033</th>
              <th scope="col" className={th}>Custo por ano</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className="border-b border-line/70">
                <th scope="row" className="min-w-[13rem] px-3 py-2 text-left font-normal">
                  <span className="block font-semibold text-ink">{l.nome}</span>
                  <span className="block text-xs text-muted">{l.dica}</span>
                </th>
                <td className={`${td} font-semibold`}>{brl(l.g27)}</td>
                <td className={td}>{brl(l.c27)}</td>
                <td className={`${td} font-semibold`}>{brl(l.g33)}</td>
                <td className={td}>{brl(l.c33)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 max-w-[68ch] text-xs text-muted">
        Caixa extra é o capital de giro adicional que a empresa precisa manter (valor negativo significa
        alívio). Custo por ano considera juros de {pct(SELIC_ANUAL, 0)} ao ano, recolhimento cerca de 40
        dias após a venda e devolução de créditos em 30 dias no modelo simplificado. O modelo que vai
        valer ainda depende de regulamentação.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function Premissas({ a }: { a: Analise }) {
  const { perfil: p, cenario } = a;
  const linhas: [string, string][] = [
    ["Regime e atividade", `${NOMES_REGIME[p.regime]}, ${NOMES_ATIVIDADE[p.atividade].toLowerCase()}`],
    ["Faturamento anual", brl(p.receitaAnual)],
    ["Compras e despesas com crédito", brl(p.comprasAnuais + p.despesasCreditaveis)],
    ["Folha e despesas sem crédito", brl(p.despesasNaoCreditaveis)],
    ["Alíquota do que vende", REDUCOES[p.reducaoVendas].nome],
    ["Alíquota do que compra", REDUCOES[p.reducaoCompras].nome],
    ["Cenário de alíquota", `${cenario.nome}: CBS ${pct(cenario.cbs, 2)} e IBS ${pct(cenario.ibs, 2)}`],
  ];
  return (
    <section aria-labelledby="titulo-premissas" className="break-inside-avoid">
      <h2 id="titulo-premissas" className="display text-2xl font-semibold text-ink">
        Premissas
      </h2>
      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex flex-col border-b border-line py-2 sm:flex-row sm:justify-between sm:gap-4">
            <dt className="text-sm text-muted">{k}</dt>
            <dd className="text-sm text-ink sm:text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 max-w-[75ch] list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Fonte da alíquota: {cenario.fonte}. As alíquotas de referência oficiais ainda serão fixadas pelo Senado.</li>
        <li>Transição conforme a LC 214/2025: CBS integral em 2027, IBS e redução de ICMS/ISS de 2029 a 2032, regime completo em 2033.</li>
        <li>IBS e CBS calculados por fora do preço. O valor pago a fornecedores fica constante; muda só o crédito aproveitado.</li>
        <li>
          Compras de fornecedores do Simples geram crédito estimado de {pct(CREDITO_FORNECEDOR_SIMPLES, 0)} no regime completo.
        </li>
        <li>Não inclui Imposto Seletivo, Zona Franca de Manaus, regimes específicos nem efeitos sobre IRPJ e CSLL.</li>
      </ul>
      <p className="mt-5 rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink">
        Isto é uma estimativa para planejamento, feita com os números que você informou. Não é apuração de
        tributos nem parecer jurídico: confira com o seu contador antes de decidir.
      </p>
    </section>
  );
}
