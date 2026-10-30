import { z } from "zod";
import type { PerfilEmpresa } from "./engine";

const fracao = z.coerce.number().min(0).max(1);
const valor = z.coerce.number().min(0).max(1e12);

/** Validação do perfil vindo de formulário/API. Percentuais chegam como fração. */
export const perfilSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  regime: z.enum(["simples", "presumido", "real"]),
  atividade: z.enum(["comercio", "industria", "servicos"]),
  receitaAnual: valor.refine((v) => v > 0, "Informe o faturamento"),
  comprasAnuais: valor,
  despesasCreditaveis: valor,
  despesasNaoCreditaveis: valor,
  aliquotaIcmsVendas: fracao,
  aliquotaIcmsCompras: fracao,
  aliquotaIss: fracao,
  aliquotaIpiVendas: fracao,
  aliquotaIpiCompras: fracao,
  aliquotaSimples: fracao,
  reducaoVendas: z.enum(["padrao", "reducao30", "reducao60", "zero"]),
  reducaoCompras: z.enum(["padrao", "reducao30", "reducao60", "zero"]),
  percentualB2B: fracao,
  percentualComprasSimples: fracao,
  prazoMedioRecebimentoDias: z.coerce.number().min(0).max(365),
}) satisfies z.ZodType<PerfilEmpresa, unknown>;

export const PERFIL_EXEMPLO: PerfilEmpresa = {
  nome: "Consultoria Exemplo Ltda",
  regime: "presumido",
  atividade: "servicos",
  receitaAnual: 2_400_000,
  comprasAnuais: 0,
  despesasCreditaveis: 260_000,
  despesasNaoCreditaveis: 1_550_000,
  aliquotaIcmsVendas: 0,
  aliquotaIcmsCompras: 0,
  aliquotaIss: 0.05,
  aliquotaIpiVendas: 0,
  aliquotaIpiCompras: 0,
  aliquotaSimples: 0.1,
  reducaoVendas: "padrao",
  reducaoCompras: "padrao",
  percentualB2B: 0.8,
  percentualComprasSimples: 0.2,
  prazoMedioRecebimentoDias: 30,
};
