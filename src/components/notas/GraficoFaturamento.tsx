"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumoMensal } from "@/lib/painel";
import { brlCompacto } from "@/components/app/formato";

export function GraficoFaturamento({ dados }: { dados: ResumoMensal[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(300, el.clientWidth));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const altura = 230;
  const m = { t: 18, r: 8, b: 30, l: 66 };
  const pw = largura - m.l - m.r;
  const max = Math.max(1, ...dados.flatMap((d) => [d.faturamento, d.ibsCbs]));
  const y = (v: number) => m.t + (altura - m.t - m.b) * (1 - v / max);
  const bw = Math.min(22, (pw / dados.length) * 0.28);
  const cx = (i: number) => m.l + (pw / dados.length) * (i + 0.5);
  const rotulo = (mes: string) => new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${mes}-02T12:00:00`)).replace(".", "");
  return (
    <figure className="m-0">
      <figcaption className="text-sm font-semibold text-ink">Faturamento autorizado e IBS/CBS · últimos 12 meses</figcaption>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span><i className="mr-2 inline-block size-2.5 rounded-sm bg-brand" />Faturamento</span>
        <span><i className="mr-2 inline-block size-2.5 rounded-sm bg-muted opacity-60" />IBS/CBS</span>
      </div>
      <div ref={ref} className="relative mt-3">
        <svg width="100%" viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Gráfico mensal de faturamento e IBS/CBS. Os dados também estão na tabela abaixo." className="block">
          {[0, 0.25, 0.5, 0.75, 1].map((p) => {
            const valor = max * p;
            return <g key={p}><line x1={m.l} x2={largura - m.r} y1={y(valor)} y2={y(valor)} stroke="var(--line)" /><text x={m.l - 7} y={y(valor)} dy=".32em" textAnchor="end" fontSize="10" fill="var(--muted)">{brlCompacto(valor)}</text></g>;
          })}
          {dados.map((d, i) => {
            const x = cx(i);
            const linha = d.mes.split("-");
            return <g key={d.mes}>
              {ativo === i && <rect x={m.l + (pw / dados.length) * i} y={m.t} width={pw / dados.length} height={altura - m.t - m.b} fill="var(--ink)" fillOpacity=".04" />}
              <rect x={x - bw - 1} y={y(d.faturamento)} width={bw} height={Math.max(1, y(0) - y(d.faturamento))} rx="3" fill="var(--brand)" />
              <rect x={x + 1} y={y(d.ibsCbs)} width={bw} height={Math.max(1, y(0) - y(d.ibsCbs))} rx="3" fill="var(--muted)" fillOpacity=".55" />
              <text x={x} y={altura - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{rotulo(d.mes)} {linha[0].slice(2)}</text>
              <rect x={m.l + (pw / dados.length) * i} y={m.t} width={pw / dados.length} height={altura - m.t - m.b} fill="transparent" tabIndex={0} aria-label={`${d.mes}: faturamento ${brlCompacto(d.faturamento)}, IBS/CBS ${brlCompacto(d.ibsCbs)}`} onPointerEnter={() => setAtivo(i)} onPointerLeave={() => setAtivo(null)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} className="outline-none focus-visible:stroke-brand" />
            </g>;
          })}
        </svg>
        {ativo !== null && <div role="status" className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm"><strong>{dados[ativo].mes}</strong><p className="mt-1 text-ink">Faturamento: {brlCompacto(dados[ativo].faturamento)}</p><p className="text-muted">IBS/CBS: {brlCompacto(dados[ativo].ibsCbs)}</p></div>}
      </div>
      <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer">Tabela acessível dos valores do gráfico</summary><div className="mt-2"><table className="w-full table-fixed break-words text-left"><thead><tr><th className="w-1/5 py-1">Mês</th><th className="w-2/5 py-1 text-right">Faturamento</th><th className="w-2/5 py-1 text-right">IBS/CBS</th></tr></thead><tbody>{dados.map((d) => <tr key={d.mes}><th className="py-1 font-medium">{d.mes}</th><td className="py-1 text-right tabular-nums">{brlCompacto(d.faturamento)}</td><td className="py-1 text-right tabular-nums">{brlCompacto(d.ibsCbs)}</td></tr>)}</tbody></table></div></details>
    </figure>
  );
}
