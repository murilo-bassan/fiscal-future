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
  nome: "Distribuidora Exemplo Ltda",
  regime: "presumido",
  atividade: "comercio",
  receitaAnual: 4_800_000,
  comprasAnuais: 2_900_000,
  despesasCreditaveis: 380_000,
  despesasNaoCreditaveis: 720_000,
  aliquotaIcmsVendas: 0.18,
  aliquotaIcmsCompras: 0.12,
  aliquotaIss: 0,
  aliquotaIpiVendas: 0,
  aliquotaIpiCompras: 0,
  aliquotaSimples: 0.1,
  reducaoVendas: "padrao",
  reducaoCompras: "padrao",
  percentualB2B: 0.7,
  percentualComprasSimples: 0.15,
  prazoMedioRecebimentoDias: 28,
};
