/**
 * Metadados dos campos do perfil: rótulo, dica, tipo e quando o campo é relevante.
 * Compartilhado entre o formulário (client) e as server actions.
 */

import type { Atividade, PerfilEmpresa, Regime } from "@/lib/tax";

export type TipoCampo = "valor" | "percentual" | "dias";

export type CampoNumerico = {
  chave: keyof PerfilEmpresa;
  tipo: TipoCampo;
  rotulo: string;
  dica: string;
  grupo: "numeros" | "aliquotas" | "clientes";
  visivel: (regime: Regime, atividade: Atividade) => boolean;
};

const sempre = () => true;
const naoSimples = (r: Regime) => r !== "simples";

export const CAMPOS_NUMERICOS: CampoNumerico[] = [
  {
    chave: "receitaAnual",
    tipo: "valor",
    rotulo: "Faturamento dos últimos 12 meses",
    dica: "Receita bruta de vendas e serviços. Está na DRE ou no PGDAS/DCTF; o contador tem esse número.",
    grupo: "numeros",
    visivel: sempre,
  },
  {
    chave: "comprasAnuais",
    tipo: "valor",
    rotulo: "Compras de mercadorias e insumos",
    dica: "Some as compras de mercadorias, matéria-prima e insumos dos últimos 12 meses.",
    grupo: "numeros",
    visivel: sempre,
  },
  {
    chave: "despesasCreditaveis",
    tipo: "valor",
    rotulo: "Despesas pagas a outras empresas",
    dica: "Energia, aluguel pago a PJ, fretes, internet, serviços terceirizados. Na reforma, essas despesas geram crédito.",
    grupo: "numeros",
    visivel: sempre,
  },
  {
    chave: "despesasNaoCreditaveis",
    tipo: "valor",
    rotulo: "Folha, pró-labore e outras despesas",
    dica: "Salários com encargos, pró-labore, aluguel pago a pessoa física, IR e CSLL. Não geram crédito.",
    grupo: "numeros",
    visivel: sempre,
  },
  {
    chave: "aliquotaSimples",
    tipo: "percentual",
    rotulo: "Alíquota efetiva do DAS",
    dica: "Divida o DAS pago nos últimos 12 meses pelo faturamento do período. Ex.: 10 para 10%.",
    grupo: "aliquotas",
    visivel: (r) => r === "simples",
  },
  {
    chave: "aliquotaIcmsVendas",
    tipo: "percentual",
    rotulo: "ICMS sobre as vendas",
    dica: "ICMS destacado nas notas de venda dividido pelo faturamento. Comércio no estado costuma ficar entre 12 e 20.",
    grupo: "aliquotas",
    visivel: (r, a) => naoSimples(r) && a !== "servicos",
  },
  {
    chave: "aliquotaIcmsCompras",
    tipo: "percentual",
    rotulo: "Crédito de ICMS nas compras",
    dica: "Crédito de ICMS aproveitado dividido pelas compras. Está no livro de apuração do ICMS.",
    grupo: "aliquotas",
    visivel: (r, a) => naoSimples(r) && a !== "servicos",
  },
  {
    chave: "aliquotaIss",
    tipo: "percentual",
    rotulo: "Alíquota de ISS",
    dica: "A alíquota que aparece na sua nota de serviço. Entre 2 e 5, conforme o município.",
    grupo: "aliquotas",
    visivel: (r, a) => naoSimples(r) && a === "servicos",
  },
  {
    chave: "aliquotaIpiVendas",
    tipo: "percentual",
    rotulo: "IPI sobre as vendas",
    dica: "IPI destacado nas notas de saída dividido pelo faturamento. Depende da TIPI do seu produto.",
    grupo: "aliquotas",
    visivel: (r, a) => naoSimples(r) && a === "industria",
  },
  {
    chave: "aliquotaIpiCompras",
    tipo: "percentual",
    rotulo: "Crédito de IPI nas compras",
    dica: "Crédito de IPI aproveitado dividido pelas compras de insumos.",
    grupo: "aliquotas",
    visivel: (r, a) => naoSimples(r) && a === "industria",
  },
  {
    chave: "percentualComprasSimples",
    tipo: "percentual",
    rotulo: "Compras de fornecedores do Simples",
    dica: "Que parte das compras vem de fornecedores do Simples Nacional. Eles vão gerar menos crédito para você.",
    grupo: "clientes",
    visivel: sempre,
  },
  {
    chave: "percentualB2B",
    tipo: "percentual",
    rotulo: "Vendas para empresas",
    dica: "Que parte do faturamento vem de clientes com CNPJ. Olhe as notas emitidas: NF-e para CNPJ × NFC-e ou nota para CPF.",
    grupo: "clientes",
    visivel: (r) => r === "simples",
  },
  {
    chave: "prazoMedioRecebimentoDias",
    tipo: "dias",
    rotulo: "Prazo médio de recebimento",
    dica: "Em quantos dias, em média, o dinheiro de uma venda cai na conta. À vista e Pix contam como 0; cartão de crédito, cerca de 30.",
    grupo: "clientes",
    visivel: (r) => naoSimples(r),
  },
];

export const NOMES_REGIME: Record<Regime, string> = {
  simples: "Simples Nacional",
  presumido: "Lucro Presumido",
  real: "Lucro Real",
};

export const NOMES_ATIVIDADE: Record<Atividade, string> = {
  comercio: "Comércio",
  industria: "Indústria",
  servicos: "Serviços",
};
