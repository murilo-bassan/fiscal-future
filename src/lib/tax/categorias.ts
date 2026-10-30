/**
 * Categorias de tratamento diferenciado na LC 214/2025, em linguagem simples.
 * Serve de base para a classificação de produtos e serviços (inclusive a feita
 * por IA). Sempre conferir o enquadramento exato (NCM/NBS) no texto da lei e
 * nos anexos antes de emitir nota.
 */

import type { Reducao } from "./params";

export type Categoria = {
  id: string;
  nome: string;
  reducao: Reducao;
  exemplos: string[];
};

export const CATEGORIAS: Categoria[] = [
  {
    id: "cesta-basica",
    nome: "Cesta Básica Nacional de Alimentos",
    reducao: "zero",
    exemplos: ["arroz", "feijão", "leite", "carnes", "ovos", "farinha de mandioca", "café", "pão francês", "manteiga", "açúcar", "massas"],
  },
  {
    id: "hortifruti",
    nome: "Hortícolas, frutas e ovos in natura",
    reducao: "zero",
    exemplos: ["frutas frescas", "verduras", "legumes", "batata", "tomate"],
  },
  {
    id: "medicamentos-zero",
    nome: "Medicamentos de listas específicas (ex.: Farmácia Popular, doenças graves)",
    reducao: "zero",
    exemplos: ["medicamentos oncológicos listados", "insulina"],
  },
  {
    id: "medicamentos",
    nome: "Demais medicamentos registrados na Anvisa",
    reducao: "reducao60",
    exemplos: ["antibióticos", "analgésicos", "medicamentos de uso contínuo"],
  },
  {
    id: "dispositivos-medicos",
    nome: "Dispositivos médicos e de acessibilidade",
    reducao: "reducao60",
    exemplos: ["órteses", "próteses", "cadeiras de rodas", "materiais hospitalares listados"],
  },
  {
    id: "saude",
    nome: "Serviços de saúde",
    reducao: "reducao60",
    exemplos: ["clínicas", "laboratórios", "hospitais", "consultas médicas", "fisioterapia"],
  },
  {
    id: "educacao",
    nome: "Serviços de educação",
    reducao: "reducao60",
    exemplos: ["escolas", "faculdades", "cursos técnicos", "ensino de idiomas listado"],
  },
  {
    id: "alimentos-reduzidos",
    nome: "Alimentos destinados ao consumo humano fora da cesta básica",
    reducao: "reducao60",
    exemplos: ["sucos naturais", "farinhas e massas listadas", "queijos", "mel"],
  },
  {
    id: "higiene",
    nome: "Produtos de higiene pessoal e limpeza de baixa renda",
    reducao: "reducao60",
    exemplos: ["sabonete", "pasta de dente", "papel higiênico", "água sanitária", "sabão em barra"],
  },
  {
    id: "agro",
    nome: "Produtos agropecuários, pesqueiros e insumos agropecuários",
    reducao: "reducao60",
    exemplos: ["fertilizantes", "sementes", "defensivos", "rações", "produtos in natura não listados"],
  },
  {
    id: "cultura",
    nome: "Produções artísticas, culturais, jornalísticas e audiovisuais nacionais",
    reducao: "reducao60",
    exemplos: ["espetáculos", "shows nacionais", "produção audiovisual"],
  },
  {
    id: "transporte-coletivo",
    nome: "Transporte público coletivo de passageiros",
    reducao: "reducao60",
    exemplos: ["ônibus urbano", "metrô", "transporte intermunicipal"],
  },
  {
    id: "seguranca",
    nome: "Bens e serviços de segurança e soberania nacional",
    reducao: "reducao60",
    exemplos: ["equipamentos de defesa listados"],
  },
  {
    id: "profissoes-regulamentadas",
    nome: "Serviços de profissões intelectuais regulamentadas",
    reducao: "reducao30",
    exemplos: ["advogados", "contadores", "engenheiros", "arquitetos", "economistas", "médicos veterinários", "psicólogos", "administradores"],
  },
  {
    id: "padrao",
    nome: "Demais bens e serviços (alíquota padrão)",
    reducao: "padrao",
    exemplos: ["vestuário", "eletrônicos", "software e SaaS", "marketing", "consultoria não regulamentada", "restaurantes (regime específico, ver lei)"],
  },
];

/** Regimes específicos que pedem análise própria e não cabem no simulador genérico. */
export const REGIMES_ESPECIFICOS = [
  "Combustíveis",
  "Serviços financeiros",
  "Planos de saúde",
  "Concursos de prognósticos",
  "Operações com bens imóveis",
  "Cooperativas",
  "Bares, restaurantes, hotelaria e agências de turismo",
  "Sociedades anônimas do futebol",
  "Missões diplomáticas",
];

/** Busca simples por palavra-chave, usada antes (ou no lugar) da IA. */
export function buscarCategoria(termo: string): Categoria[] {
  const t = normalizar(termo);
  if (!t) return [];
  return CATEGORIAS.filter(
    (c) => normalizar(c.nome).includes(t) || c.exemplos.some((e) => normalizar(e).includes(t) || t.includes(normalizar(e))),
  );
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
