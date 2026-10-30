import type { IdProvedor, ProvedorFiscal } from "../tipos";
import { provedorFocus } from "./focus";
import { provedorSimulado } from "./simulado";

export const PROVEDORES: Record<IdProvedor, ProvedorFiscal> = {
  simulado: provedorSimulado,
  focus: provedorFocus,
};

export function provedor(id: string): ProvedorFiscal {
  const p = PROVEDORES[id as IdProvedor];
  if (!p) throw new Error(`Provedor de emissão desconhecido: ${id}`);
  return p;
}
