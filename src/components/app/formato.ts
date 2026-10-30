/**
 * Formatação e leitura de números no padrão brasileiro.
 * Sem dependências de servidor: usado tanto em server quanto em client components.
 */

import { brl, pct } from "@/lib/planos";

export { brl, pct };

/** Percentual com sinal explícito: +4,2% / −1,3% / 0,0%. */
export function pctSinal(v: number, casas = 1) {
  const arred = Number((v * 100).toFixed(casas));
  if (arred === 0) return pct(0, casas);
  const s = pct(Math.abs(v), casas);
  return arred > 0 ? `+${s}` : `−${s}`;
}

/** R$ com sinal explícito (para diferenças). */
export function brlSinal(v: number) {
  if (Math.round(v) === 0) return brl(0);
  return v > 0 ? `+${brl(v)}` : `−${brl(Math.abs(v))}`;
}

/** R$ compacto para eixos e rótulos curtos: R$ 850 mil, R$ 1,2 mi. */
export function brlCompacto(v: number) {
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  const num = (x: number, casas: number) =>
    x.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
  if (a >= 1e9) return `${sinal}R$ ${num(a / 1e9, 1)} bi`;
  if (a >= 1e6) return `${sinal}R$ ${num(a / 1e6, 1)} mi`;
  if (a >= 1e3) return `${sinal}R$ ${num(a / 1e3, 0)} mil`;
  return `${sinal}R$ ${num(a, 0)}`;
}

/**
 * Lê um valor em reais digitado pelo usuário: "4.800.000", "4800000,50",
 * "R$ 1.234,56", "1234.56". Retorna NaN se não der para entender.
 */
export function lerValor(texto: string): number {
  let s = texto.replace(/R\$|\s/g, "").trim();
  if (!s) return NaN;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Lê um percentual digitado como "18", "18,5" ou "18.5%". Retorna o número em pontos (18.5). */
export function lerPercentual(texto: string): number {
  const s = texto.replace(/%|\s/g, "").replace(",", ".").trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Valor em reais para exibir dentro de um campo de formulário: 4.800.000 */
export function valorParaCampo(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Fração (0,18) para exibir num campo de percentual: "18" */
export function fracaoParaCampo(v: number) {
  return Number((v * 100).toFixed(4)).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}
