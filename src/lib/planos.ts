/**
 * Planos e limites. Preço em reais por mês; o anual dá 2 meses grátis.
 * A âncora de valor: um estudo de impacto da reforma com consultoria custa
 * de R$ 5 mil a R$ 30 mil, e precisa ser refeito a cada mudança de alíquota.
 */

export type PlanoId = "gratis" | "essencial" | "profissional" | "contador";

export type Plano = {
  id: PlanoId;
  nome: string;
  precoMensal: number;
  publico: string;
  empresas: number;
  classificacoesMes: number;
  relatorioPdf: boolean;
  classificacaoLote: boolean;
  marcaPropria: boolean;
  destaque?: boolean;
  recursos: string[];
};

export const PLANOS: Record<PlanoId, Plano> = {
  gratis: {
    id: "gratis",
    nome: "Grátis",
    precoMensal: 0,
    publico: "Para ver o tamanho do problema",
    empresas: 1,
    classificacoesMes: 5,
    relatorioPdf: false,
    classificacaoLote: false,
    marcaPropria: false,
    recursos: [
      "1 empresa",
      "Simulação de impacto 2026–2033",
      "5 classificações de produtos por mês",
    ],
  },
  essencial: {
    id: "essencial",
    nome: "Essencial",
    precoMensal: 97,
    publico: "Para o dono de PME",
    empresas: 1,
    classificacoesMes: 100,
    relatorioPdf: true,
    classificacaoLote: false,
    marcaPropria: false,
    recursos: [
      "Tudo do Grátis",
      "Novo preço para manter a margem",
      "Simples puro ou híbrido: qual escolher",
      "Impacto do split payment no caixa",
      "Relatório em PDF",
      "100 classificações por mês",
    ],
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    precoMensal: 297,
    publico: "Para grupos e empresas com muitos itens",
    empresas: 5,
    classificacoesMes: 1000,
    relatorioPdf: true,
    classificacaoLote: true,
    marcaPropria: false,
    destaque: true,
    recursos: [
      "Tudo do Essencial",
      "Até 5 CNPJs",
      "Classificação em lote (planilha CSV)",
      "1.000 classificações por mês",
      "Cenários de alíquota lado a lado",
    ],
  },
  contador: {
    id: "contador",
    nome: "Escritório Contábil",
    precoMensal: 797,
    publico: "Para revender a reforma como serviço",
    empresas: 60,
    classificacoesMes: 5000,
    relatorioPdf: true,
    classificacaoLote: true,
    marcaPropria: true,
    recursos: [
      "Tudo do Profissional",
      "Até 60 clientes (R$ 13 por cliente)",
      "Relatórios com a marca do seu escritório",
      "5.000 classificações por mês",
    ],
  },
};

export const PLANOS_PAGOS = [PLANOS.essencial, PLANOS.profissional, PLANOS.contador];

export function plano(id: string | null | undefined): Plano {
  return PLANOS[(id as PlanoId) ?? "gratis"] ?? PLANOS.gratis;
}

export const brl = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

export const pct = (v: number, casas = 1) =>
  `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
