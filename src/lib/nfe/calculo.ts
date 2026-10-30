/**
 * Cálculo do IBS e da CBS de um item de nota fiscal, no formato do grupo
 * IBSCBS da NT 2025.002 (NF-e/NFC-e) e do grupo equivalente da NFS-e nacional.
 *
 * Alíquotas por ano (LC 214/2025):
 *  - 2026: CBS 0,9%, IBS estadual 0,1%, IBS municipal 0%. Valores destacados,
 *          compensáveis com PIS/Cofins (não somam ao total da nota).
 *  - 2027-2028: CBS = referência − 0,1 p.p.; IBS 0,05% estadual + 0,05% municipal.
 *  - 2029 em diante: o IBS cresce até a referência. A divisão entre estado e
 *    município será fixada por cada ente; usamos uma estimativa (ver PARTILHA_IBS_UF).
 */

import { REDUCOES, TRANSICAO, DEFAULT_CENARIO, type CenarioAliquota } from "../tax/params";
import type { Categoria } from "../tax/categorias";

/**
 * Fração do IBS que fica com o estado a partir de 2029. Estimativa a partir das
 * alíquotas médias atuais de ICMS e ISS; cada UF e município fixará a sua.
 * Só afeta a divisão estado/município, não o total do IBS.
 */
export const PARTILHA_IBS_UF = 0.85;

export type AliquotasNota = {
  ano: number;
  cbs: number; // fração
  ibsUf: number;
  ibsMun: number;
  /** Em 2026 o destaque é informativo e compensável: não soma ao total. */
  compensavel: boolean;
};

export function aliquotasNota(ano: number, cenario: CenarioAliquota = DEFAULT_CENARIO): AliquotasNota {
  const a = Math.min(Math.max(ano, 2026), 2033);
  if (a === 2026) return { ano: a, cbs: 0.009, ibsUf: 0.001, ibsMun: 0, compensavel: true };
  if (a <= 2028) {
    return { ano: a, cbs: Math.max(cenario.cbs - 0.001, 0), ibsUf: 0.0005, ibsMun: 0.0005, compensavel: false };
  }
  const fase = TRANSICAO.find((t) => t.ano === a)!;
  const ibs = fase.ibs(cenario.ibs);
  return {
    ano: a,
    cbs: fase.cbs(cenario.cbs),
    ibsUf: ibs * PARTILHA_IBS_UF,
    ibsMun: ibs * (1 - PARTILHA_IBS_UF),
    compensavel: false,
  };
}

/** CSTs que não levam o grupo gIBSCBS (isenção, imunidade, não incidência). */
const CST_SEM_GRUPO = new Set(["400", "410"]);

export type ParcelaTributo = {
  aliquota: number; // nominal (fração)
  reducao: number; // fração de redução da alíquota
  aliquotaEfetiva: number;
  valor: number;
};

export type IbsCbsItem = {
  cst: string;
  cClassTrib: string;
  /** false para CST de isenção/imunidade: a nota leva só CST e cClassTrib. */
  temGrupo: boolean;
  base: number;
  ibsUf: ParcelaTributo;
  ibsMun: ParcelaTributo;
  cbs: ParcelaTributo;
  vIBS: number;
  total: number; // vIBS + vCBS
  compensavel: boolean;
};

export const arred = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function parcela(aliquota: number, reducao: number, base: number): ParcelaTributo {
  const efetiva = aliquota * (1 - reducao);
  return { aliquota, reducao, aliquotaEfetiva: efetiva, valor: arred(base * efetiva) };
}

/**
 * Calcula IBS/CBS de um item. `base` já deve estar líquida (ver baseIbsCbs).
 */
export function calcularIbsCbsItem(
  base: number,
  categoria: Pick<Categoria, "cst" | "cClassTrib" | "reducao">,
  aliq: AliquotasNota,
): IbsCbsItem {
  const temGrupo = !CST_SEM_GRUPO.has(categoria.cst);
  const reducao = temGrupo ? REDUCOES[categoria.reducao].reducao : 1;
  const b = temGrupo ? arred(Math.max(base, 0)) : 0;
  const ibsUf = parcela(aliq.ibsUf, reducao, b);
  const ibsMun = parcela(aliq.ibsMun, reducao, b);
  const cbs = parcela(aliq.cbs, reducao, b);
  const vIBS = arred(ibsUf.valor + ibsMun.valor);
  return {
    cst: categoria.cst,
    cClassTrib: categoria.cClassTrib,
    temGrupo,
    base: b,
    ibsUf,
    ibsMun,
    cbs,
    vIBS,
    total: arred(vIBS + cbs.valor),
    compensavel: aliq.compensavel,
  };
}

/**
 * Base de cálculo do IBS/CBS de um item (NT 2025.002): valor da operação mais
 * acréscimos, menos descontos e menos os tributos antigos que ainda existem
 * (ICMS, PIS, Cofins, ISS), que não integram a base durante a transição.
 */
export function baseIbsCbs(v: {
  valor: number;
  frete?: number;
  seguro?: number;
  outros?: number;
  desconto?: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  iss?: number;
}): number {
  return arred(
    v.valor +
      (v.frete ?? 0) +
      (v.seguro ?? 0) +
      (v.outros ?? 0) -
      (v.desconto ?? 0) -
      (v.icms ?? 0) -
      (v.pis ?? 0) -
      (v.cofins ?? 0) -
      (v.iss ?? 0),
  );
}
