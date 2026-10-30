import type { Reducao } from "@/lib/tax/params";
import type { Confianca } from "@/lib/classificador";

export const ROTULO_REDUCAO: Record<Reducao, string> = {
  padrao: "Padrão",
  reducao30: "−30%",
  reducao60: "−60%",
  zero: "Zero",
};

export const ROTULO_CONFIANCA: Record<Confianca, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
