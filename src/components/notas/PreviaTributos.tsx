/**
 * Quadro de tributos por item e totais, no espírito do "cálculo do imposto" do
 * DANFE. Componente puro: serve na prévia ao vivo (cliente) e no detalhe (servidor).
 */

import type { CalculoRascunho } from "@/lib/emissao/calculo";
import type { TipoNota } from "@/lib/emissao/tipos";
import { brl, pct } from "@/components/app/formato";

type Props = {
  tipo: TipoNota;
  calculo: CalculoRascunho;
  descricoes: string[];
  titulo?: string;
};

function Linha({ rotulo, valor, forte, suave }: { rotulo: string; valor: string; forte?: boolean; suave?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${forte ? "font-semibold text-ink" : ""}`}>
      <dt className={suave ? "text-muted" : "text-ink"}>{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}

export function PreviaTributos({ tipo, calculo, descricoes, titulo = "Tributos da nota" }: Props) {
  const t = calculo.totais;
  const informativo = calculo.ano <= 2026;
  const b2 = (v: number) => brl(v, 2);
  const temItens = calculo.itens.length > 0;

  return (
    <section aria-label={titulo} className="rounded-xl border border-line bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="display text-lg font-semibold text-ink">{titulo}</h2>
        <span className="text-xs text-muted">Regras de {calculo.ano}</span>
      </header>

      {temItens && (
        <ol className="divide-y divide-line px-4 text-sm">
          {calculo.itens.map((ci, i) => {
            const ib = ci.ibsCbs;
            return (
              <li key={i} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-ink">
                    {i + 1}. {descricoes[i] || "Item sem descrição"}
                  </span>
                  <span className="tabular-nums text-ink">{b2(ci.valor)}</span>
                </div>
                <dl className="mt-1 grid grid-cols-2 gap-x-4 text-xs text-muted">
                  {tipo === "nfe" ? (
                    <div className="flex justify-between">
                      <dt>ICMS</dt>
                      <dd className="tabular-nums">{b2(ci.icms)}</dd>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <dt>ISS</dt>
                      <dd className="tabular-nums">{b2(ci.iss)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt>PIS + Cofins</dt>
                    <dd className="tabular-nums">{b2(ci.pis + ci.cofins)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>CBS {ib.temGrupo ? pct(ib.cbs.aliquotaEfetiva, 2) : ""}</dt>
                    <dd className="tabular-nums">{b2(ib.cbs.valor)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>IBS {ib.temGrupo ? pct(ib.ibsUf.aliquotaEfetiva + ib.ibsMun.aliquotaEfetiva, 2) : ""}</dt>
                    <dd className="tabular-nums">{b2(ib.vIBS)}</dd>
                  </div>
                </dl>
                <p className="mt-1 text-xs text-muted">
                  CST {ib.cst}, cClassTrib {ib.cClassTrib}
                  {ib.temGrupo ? `, base ${b2(ib.base)}` : ". Sem IBS/CBS (isenção ou imunidade)"}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <dl className="border-t-2 border-ink/80 px-4 py-3 text-sm">
        <Linha rotulo="Produtos e serviços" valor={b2(t.produtos)} suave />
        {t.desconto > 0 && <Linha rotulo="Descontos" valor={`− ${b2(t.desconto)}`} suave />}
        {tipo === "nfe" ? <Linha rotulo="ICMS" valor={b2(t.icms)} suave /> : <Linha rotulo="ISS" valor={b2(t.iss)} suave />}
        {t.pis + t.cofins > 0 && <Linha rotulo="PIS + Cofins" valor={b2(t.pis + t.cofins)} suave />}
        <Linha rotulo="Base do IBS/CBS" valor={b2(t.base)} suave />
        <Linha rotulo="CBS (federal)" valor={b2(t.cbs)} />
        <Linha rotulo="IBS (estado + município)" valor={b2(t.ibs)} />
        <div className="mt-2 border-t border-line pt-2">
          <Linha rotulo="Total da nota" valor={b2(t.nota)} forte />
          {t.notaComIbsCbs !== t.nota && <Linha rotulo="Cliente paga, com IBS/CBS por fora" valor={b2(t.notaComIbsCbs)} forte />}
        </div>
      </dl>

      <p className="rounded-b-xl bg-brand-soft px-4 py-3 text-xs leading-relaxed text-ink">
        {informativo
          ? "Em 2026 o IBS e a CBS aparecem na nota só para informar: são compensados com PIS/Cofins e não aumentam o total."
          : calculo.simples
            ? "No Simples, o IBS/CBS continua dentro do DAS e não soma ao total da nota."
            : "A partir de 2027 o IBS e a CBS são cobrados por fora: somam ao que o cliente paga."}
      </p>
    </section>
  );
}
