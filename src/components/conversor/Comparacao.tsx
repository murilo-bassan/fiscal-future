import { brl, pctSinal } from "@/components/app/formato";
import type { ResultadoSalvo } from "./modelo";

/**
 * O destaque da tela: quanto de tributo sobre consumo a nota teve e quanto a
 * mesma operação teria no ano escolhido.
 */
export function Comparacao({ r }: { r: ResultadoSalvo }) {
  const { totais, ano } = r;
  const antigosNoAno = r.itens.reduce((s, i) => s + i.tributosAntigosNoAno, 0);
  const compensavel = ano === 2026;
  const diff = totais.totalNoAno - totais.tributosOriginais;
  const cor = Math.abs(totais.variacao) < 0.0005 ? "text-ink" : diff > 0 ? "text-bad" : "text-good";
  const fundo = Math.abs(totais.variacao) < 0.0005 ? "bg-paper" : diff > 0 ? "bg-bad-soft" : "bg-good-soft";

  return (
    <section aria-label="Comparação dos tributos" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid sm:grid-cols-[1fr_auto_1fr]">
        <div className="px-5 py-5 sm:px-6">
          <p className="text-sm text-muted">Tributos na nota original</p>
          <p className="display mt-1 text-3xl leading-none text-muted sm:text-4xl">{brl(totais.tributosOriginais, 2)}</p>
          <p className="mt-2 text-xs text-muted">ICMS, PIS, Cofins, IPI e ISS destacados</p>
        </div>
        <div aria-hidden className="flex items-center justify-center border-y border-line px-4 py-1 text-xl text-muted sm:border-x sm:border-y-0">
          <span className="rotate-90 sm:rotate-0">→</span>
        </div>
        <div className={`px-5 py-5 sm:px-6 ${fundo}`}>
          <p className="text-sm text-ink">No modelo de {ano}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="display text-4xl leading-none text-ink sm:text-5xl">{brl(totais.totalNoAno, 2)}</span>
            <span className={`text-lg font-semibold ${cor}`}>
              {totais.tributosOriginais ? `(${pctSinal(totais.variacao)})` : ""}
            </span>
          </p>
          <p className="mt-2 text-xs text-ink/80">
            {compensavel
              ? "Mesmo valor a pagar: o IBS e a CBS de 2026 são compensados com PIS/Cofins."
              : ano >= 2033
                ? "Só IBS e CBS."
                : "IBS e CBS mais os tributos antigos que continuam."}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 border-t border-line text-sm sm:grid-cols-4">
        <Parcela rotulo="CBS" valor={totais.cbs} />
        <Parcela rotulo="IBS" valor={totais.ibs} detalhe={`estado ${brl(totais.ibsUf, 2)}, município ${brl(totais.ibsMun, 2)}`} />
        <Parcela rotulo={compensavel ? "IBS/CBS destacado" : "Base do IBS/CBS"} valor={compensavel ? totais.ibsCbs : totais.base} />
        <Parcela rotulo="Antigos que continuam" valor={antigosNoAno} />
      </dl>
    </section>
  );
}

function Parcela({ rotulo, valor, detalhe }: { rotulo: string; valor: number; detalhe?: string }) {
  return (
    <div className="border-line px-5 py-3 odd:border-r sm:border-r sm:last:border-r-0 sm:px-6 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{brl(valor, 2)}</dd>
      {detalhe && <dd className="text-xs text-muted">{detalhe}</dd>}
    </div>
  );
}
