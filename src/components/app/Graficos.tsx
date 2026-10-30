"use client";

/**
 * Gráficos em SVG feito à mão. Medem a largura real do contêiner (texto nunca
 * encolhe em telas de 360px), têm camada de hover/foco com tooltip e usam só os
 * tokens de cor do tema, então seguem o modo escuro sozinhos.
 *
 * Cores: IBS/CBS (o assunto) em --brand; tributos atuais (o que está saindo) em
 * --muted a 50%, como série de contexto. Par validado com o validador da skill
 * dataviz: ΔE 16,7 (protan) no claro e ~19 no escuro. A tabela ano a ano da
 * página é o equivalente acessível de cada gráfico.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { brlCompacto, pctSinal } from "./formato";

type Formato = "brl" | "pctSinal";

function formatar(v: number, f: Formato, casas = 1) {
  return f === "brl" ? brlCompacto(v) : pctSinal(v, casas);
}

function useLargura(inicial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setW(Math.max(260, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function marcas(min: number, max: number, n = 4) {
  if (min === max) max = min + 1;
  const bruto = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= bruto) ?? 10 * mag;
  const lo = Math.floor(min / passo) * passo;
  const hi = Math.ceil(max / passo) * passo;
  const out: number[] = [];
  for (let v = lo; v <= hi + passo / 2; v += passo) out.push(Number(v.toFixed(10)));
  return out;
}

/** Retângulo com ponta arredondada (4px) só na extremidade dos dados. */
function barra(x: number, y: number, w: number, h: number, ponta: "cima" | "baixo" | null) {
  if (h <= 0) return "";
  const r = ponta ? Math.min(4, h, w / 2) : 0;
  if (ponta === "cima") {
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  if (ponta === "baixo") {
    return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
  }
  return `M${x},${y}H${x + w}V${y + h}H${x}Z`;
}

const COR = {
  brand: { fill: "var(--brand)", opacity: 1 },
  muted: { fill: "var(--muted)", opacity: 0.5 },
} as const;
type Tom = keyof typeof COR;

function Tooltip({ x, largura, children }: { x: number; largura: number; children: ReactNode }) {
  const w = 190;
  const left = Math.min(Math.max(x - w / 2, 0), largura - w);
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm"
      style={{ left, width: w }}
    >
      {children}
    </div>
  );
}

function LinhaTooltip({ tom, nome, valor }: { tom: Tom; nome: string; valor: string }) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <svg width="12" height="4" aria-hidden className="shrink-0">
        <line x1="0" y1="2" x2="12" y2="2" stroke={COR[tom].fill} strokeOpacity={COR[tom].opacity} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="font-semibold tabular-nums text-ink">{valor}</span>
      <span className="truncate text-muted">{nome}</span>
    </div>
  );
}

export function Legenda({ itens, forma }: { itens: { nome: string; tom: Tom }[]; forma: "barra" | "linha" }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-2">
          <svg width="14" height="10" aria-hidden className="shrink-0">
            {forma === "barra" ? (
              <rect width="10" height="10" rx="2" fill={COR[i.tom].fill} fillOpacity={COR[i.tom].opacity} />
            ) : (
              <line x1="0" y1="5" x2="14" y2="5" stroke={COR[i.tom].fill} strokeOpacity={COR[i.tom].opacity} strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
          {i.nome}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Colunas empilhadas: carga tributária por ano                        */
/* ------------------------------------------------------------------ */

export type PontoCarga = { ano: number; antigos: number; novo: number };

export function GraficoCarga({
  dados,
  nomeAntigos,
  nomeNovo,
  titulo,
  altura = 240,
}: {
  dados: PontoCarga[];
  nomeAntigos: string;
  nomeNovo: string;
  titulo: string;
  altura?: number;
}) {
  const [ref, largura] = useLargura(640);
  const [ativo, setAtivo] = useState<number | null>(null);
  const temNovo = dados.some((d) => Math.abs(d.novo) > 0.5);

  const m = { t: 22, r: 8, b: 26, l: 60 };
  const pw = largura - m.l - m.r;
  const ph = altura - m.t - m.b;

  const pos = (d: PontoCarga) => Math.max(d.antigos, 0) + Math.max(d.novo, 0);
  const neg = (d: PontoCarga) => Math.min(d.antigos, 0) + Math.min(d.novo, 0);
  const t = marcas(Math.min(0, ...dados.map(neg)), Math.max(0, ...dados.map(pos)));
  const yMin = t[0];
  const yMax = t[t.length - 1];
  const y = (v: number) => m.t + ph - ((v - yMin) / (yMax - yMin)) * ph;

  const banda = pw / dados.length;
  const bw = Math.min(24, banda * 0.6);
  const cx = (i: number) => m.l + banda * i + banda / 2;

  // Rótulos diretos só no primeiro e no último ano (e no maior, se for outro).
  const iMax = dados.reduce((im, d, i) => (pos(d) + neg(d) > pos(dados[im]) + neg(dados[im]) ? i : im), 0);
  const rotular = new Set([0, dados.length - 1, iMax]);

  return (
    <figure className="m-0">
      <figcaption className="text-sm font-semibold text-ink">{titulo}</figcaption>
      <div className="mt-2">
        <Legenda
          forma="barra"
          itens={[{ nome: nomeAntigos, tom: "muted" as Tom }, ...(temNovo ? [{ nome: nomeNovo, tom: "brand" as Tom }] : [])]}
        />
      </div>
      <div ref={ref} className="relative mt-3">
        <svg
          width="100%"
          viewBox={`0 0 ${largura} ${altura}`}
          style={{ height: "auto" }}
          role="img"
          aria-label={`${titulo}. Os valores estão na tabela ano a ano.`}
          className="block overflow-visible"
        >
          {t.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={largura - m.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
                {brlCompacto(v)}
              </text>
            </g>
          ))}
          <line x1={m.l} x2={largura - m.r} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeOpacity={0.6} strokeWidth={1} />

          {dados.map((d, i) => {
            const x = cx(i) - bw / 2;
            const segs: { tom: Tom; v: number }[] = [
              { tom: "muted", v: d.antigos },
              { tom: "brand", v: d.novo },
            ];
            const positivos = segs.filter((s) => s.v > 0.5);
            const negativos = segs.filter((s) => s.v < -0.5);
            let topo = 0;
            let fundo = 0;
            const paths: ReactNode[] = [];
            positivos.forEach((s, k) => {
              const y0 = y(topo);
              const y1 = y(topo + s.v);
              const gap = k > 0 ? 2 : 0;
              paths.push(
                <path key={`p${k}`} d={barra(x, y1, bw, y0 - y1 - gap, k === positivos.length - 1 ? "cima" : null)} fill={COR[s.tom].fill} fillOpacity={COR[s.tom].opacity} />,
              );
              topo += s.v;
            });
            negativos.forEach((s, k) => {
              const y0 = y(fundo);
              const y1 = y(fundo + s.v);
              const gap = k > 0 ? 2 : 0;
              paths.push(
                <path key={`n${k}`} d={barra(x, y0 + gap, bw, y1 - y0 - gap, k === negativos.length - 1 ? "baixo" : null)} fill={COR[s.tom].fill} fillOpacity={COR[s.tom].opacity} />,
              );
              fundo += s.v;
            });
            const total = d.antigos + d.novo;
            return (
              <g key={d.ano}>
                {ativo === i && <rect x={m.l + banda * i} y={m.t} width={banda} height={ph} fill="var(--ink)" fillOpacity={0.04} />}
                {paths}
                {rotular.has(i) && (
                  <text x={cx(i)} y={y(topo) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--ink)" className="tabular-nums">
                    {brlCompacto(total)}
                  </text>
                )}
                <text x={cx(i)} y={altura - 8} textAnchor="middle" fontSize={11} fill="var(--muted)" className="tabular-nums">
                  {banda < 34 ? `’${String(d.ano).slice(2)}` : d.ano}
                </text>
                <rect
                  x={m.l + banda * i}
                  y={m.t}
                  width={banda}
                  height={ph}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.ano}: carga total ${brlCompacto(total)}`}
                  onPointerEnter={() => setAtivo(i)}
                  onPointerLeave={() => setAtivo(null)}
                  onFocus={() => setAtivo(i)}
                  onBlur={() => setAtivo(null)}
                  className="outline-none focus-visible:stroke-brand"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </svg>
        {ativo !== null && (
          <Tooltip x={cx(ativo)} largura={largura}>
            <div className="text-muted">{dados[ativo].ano}</div>
            <div className="text-sm font-semibold tabular-nums text-ink">
              {brlCompacto(dados[ativo].antigos + dados[ativo].novo)}{" "}
              <span className="text-xs font-normal text-muted">no total</span>
            </div>
            <LinhaTooltip tom="muted" nome={nomeAntigos} valor={brlCompacto(dados[ativo].antigos)} />
            {temNovo && <LinhaTooltip tom="brand" nome={nomeNovo} valor={brlCompacto(dados[ativo].novo)} />}
          </Tooltip>
        )}
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Linhas: índice de preço, lucro puro × híbrido                       */
/* ------------------------------------------------------------------ */

export type Serie = { nome: string; valores: number[]; tom: Tom };

export function GraficoLinha({
  anos,
  series,
  formato,
  titulo,
  referencia,
  rotuloReferencia,
  altura = 220,
}: {
  anos: number[];
  series: Serie[];
  formato: Formato;
  titulo: string;
  referencia?: number;
  rotuloReferencia?: string;
  altura?: number;
}) {
  const [ref, largura] = useLargura(640);
  const [ativo, setAtivo] = useState<number | null>(null);

  const todos = series.flatMap((s) => s.valores);
  const lo = Math.min(...todos, referencia ?? Infinity);
  const hi = Math.max(...todos, referencia ?? -Infinity);
  const intervalo = hi - lo;
  const casas = formato === "pctSinal" && intervalo < 0.05 ? 1 : 0;
  const t = marcas(lo, hi);
  const yMin = t[0];
  const yMax = t[t.length - 1];

  const m = { t: 14, r: 72, b: 26, l: formato === "brl" ? 64 : 48 };
  const pw = largura - m.l - m.r;
  const ph = altura - m.t - m.b;
  const x = (i: number) => m.l + (anos.length === 1 ? pw / 2 : (pw * i) / (anos.length - 1));
  const y = (v: number) => m.t + ph - ((v - yMin) / (yMax - yMin)) * ph;

  const finais = series.map((s) => y(s.valores[s.valores.length - 1]));
  const colidem = finais.some((a, i) => finais.some((b, j) => i < j && Math.abs(a - b) < 14));
  const passoX = pw / Math.max(anos.length - 1, 1);

  return (
    <figure className="m-0">
      <figcaption className="text-sm font-semibold text-ink">{titulo}</figcaption>
      {series.length > 1 && (
        <div className="mt-2">
          <Legenda forma="linha" itens={series.map((s) => ({ nome: s.nome, tom: s.tom }))} />
        </div>
      )}
      <div ref={ref} className="relative mt-3">
        <svg
          width="100%"
          viewBox={`0 0 ${largura} ${altura}`}
          style={{ height: "auto" }}
          role="img"
          aria-label={`${titulo}. Os valores estão na tabela ano a ano.`}
          className="block overflow-visible"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * largura;
            const i = Math.round((px - m.l) / passoX);
            setAtivo(Math.min(Math.max(i, 0), anos.length - 1));
          }}
          onPointerLeave={() => setAtivo(null)}
        >
          {t.map((v) => (
            <g key={v}>
              <line x1={m.l} x2={largura - m.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={m.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular-nums">
                {formatar(v, formato, casas)}
              </text>
            </g>
          ))}
          {referencia !== undefined && (
            <g>
              <line x1={m.l} x2={largura - m.r} y1={y(referencia)} y2={y(referencia)} stroke="var(--muted)" strokeWidth={1} />
              {rotuloReferencia && (
                <text x={largura - m.r + 6} y={y(referencia)} dy="0.32em" fontSize={11} fill="var(--muted)">
                  {rotuloReferencia}
                </text>
              )}
            </g>
          )}
          {anos.map((a, i) => (
            <text key={a} x={x(i)} y={altura - 8} textAnchor="middle" fontSize={11} fill="var(--muted)" className="tabular-nums">
              {passoX < 34 ? `’${String(a).slice(2)}` : a}
            </text>
          ))}
          {ativo !== null && (
            <line x1={x(ativo)} x2={x(ativo)} y1={m.t} y2={m.t + ph} stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1} />
          )}
          {series.map((s, k) => {
            const ultimo = s.valores.length - 1;
            return (
              <g key={s.nome}>
                <polyline
                  points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                  fill="none"
                  stroke={COR[s.tom].fill}
                  strokeOpacity={s.tom === "muted" ? 0.7 : 1}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx={x(ultimo)} cy={y(s.valores[ultimo])} r={4} fill={COR[s.tom].fill} stroke="var(--surface)" strokeWidth={2} />
                {ativo !== null && (
                  <circle cx={x(ativo)} cy={y(s.valores[ativo])} r={4} fill={COR[s.tom].fill} stroke="var(--surface)" strokeWidth={2} />
                )}
                {!colidem && (
                  <text x={x(ultimo) + 10} y={finais[k]} dy="0.32em" fontSize={11} fontWeight={600} fill="var(--ink)" className="tabular-nums">
                    {formatar(s.valores[ultimo], formato)}
                  </text>
                )}
              </g>
            );
          })}
          {/* Alvos de foco por ano, para teclado */}
          {anos.map((a, i) => (
            <rect
              key={a}
              x={x(i) - passoX / 2}
              y={m.t}
              width={passoX}
              height={ph}
              fill="transparent"
              tabIndex={0}
              aria-label={`${a}: ${series.map((s) => `${s.nome} ${formatar(s.valores[i], formato)}`).join("; ")}`}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className="outline-none"
            />
          ))}
        </svg>
        {ativo !== null && (
          <Tooltip x={x(ativo)} largura={largura}>
            <div className="text-muted">{anos[ativo]}</div>
            {series.map((s) => (
              <LinhaTooltip key={s.nome} tom={s.tom} nome={s.nome} valor={formatar(s.valores[ativo], formato)} />
            ))}
          </Tooltip>
        )}
      </div>
    </figure>
  );
}
