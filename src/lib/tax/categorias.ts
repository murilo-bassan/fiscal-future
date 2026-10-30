/**
 * Categorias de tratamento diferenciado na LC 214/2025, em linguagem simples,
 * com o CST e o cClassTrib da tabela do Informe Técnico 2025.002 (Portal da NF-e).
 * Servem de base para a classificação de itens (inclusive por IA) e para
 * preencher o grupo IBS/CBS das notas. A tabela oficial é versionada: confira a
 * versão vigente antes de emitir em produção. O enquadramento exato depende do
 * NCM/NBS constar no anexo correspondente da lei.
 */

import type { Reducao } from "./params";

export type Categoria = {
  id: string;
  nome: string;
  reducao: Reducao;
  /** Código de Situação Tributária do IBS/CBS (3 dígitos). */
  cst: string;
  /** Código de Classificação Tributária do IBS/CBS (6 dígitos). */
  cClassTrib: string;
  exemplos: string[];
};

export const CATEGORIAS: Categoria[] = [
  {
    id: "cesta-basica",
    nome: "Cesta Básica Nacional de Alimentos",
    reducao: "zero",
    cst: "200",
    cClassTrib: "200003",
    exemplos: ["arroz", "feijão", "leite", "carnes", "ovos", "farinha de mandioca", "café", "pão francês", "manteiga", "açúcar", "massas"],
  },
  {
    id: "hortifruti",
    nome: "Hortícolas, frutas e ovos in natura",
    reducao: "zero",
    cst: "200",
    cClassTrib: "200014",
    exemplos: ["frutas frescas", "verduras", "legumes", "batata", "tomate"],
  },
  {
    id: "medicamentos-zero",
    nome: "Medicamentos da lista de alíquota zero",
    reducao: "zero",
    cst: "200",
    cClassTrib: "200009",
    exemplos: ["medicamentos oncológicos listados", "insulina"],
  },
  {
    id: "absorventes",
    nome: "Absorventes e coletores menstruais",
    reducao: "zero",
    cst: "200",
    cClassTrib: "200013",
    exemplos: ["absorvente", "tampão", "coletor menstrual", "calcinha absorvente"],
  },
  {
    id: "livros",
    nome: "Livros, jornais e periódicos (imunidade)",
    reducao: "zero",
    cst: "410",
    cClassTrib: "410008",
    exemplos: ["livro", "jornal", "revista", "papel para impressão de livros"],
  },
  {
    id: "transporte-urbano",
    nome: "Transporte público coletivo urbano e metropolitano (isenção)",
    reducao: "zero",
    cst: "400",
    cClassTrib: "400001",
    exemplos: ["ônibus urbano", "metrô"],
  },
  {
    id: "medicamentos",
    nome: "Demais medicamentos registrados na Anvisa",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200032",
    exemplos: ["antibióticos", "analgésicos", "medicamentos de uso contínuo", "farmácia de manipulação"],
  },
  {
    id: "dispositivos-medicos",
    nome: "Dispositivos médicos",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200030",
    exemplos: ["materiais hospitalares listados", "seringas", "luvas cirúrgicas", "órteses", "próteses"],
  },
  {
    id: "acessibilidade",
    nome: "Dispositivos de acessibilidade para pessoas com deficiência",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200031",
    exemplos: ["cadeira de rodas", "aparelho auditivo", "bengala"],
  },
  {
    id: "saude",
    nome: "Serviços de saúde humana",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200029",
    exemplos: ["clínicas", "laboratórios", "hospitais", "consultas médicas", "fisioterapia", "odontologia"],
  },
  {
    id: "educacao",
    nome: "Serviços de educação",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200028",
    exemplos: ["escolas", "faculdades", "mensalidade escolar", "cursos técnicos"],
  },
  {
    id: "alimentos-reduzidos",
    nome: "Alimentos para consumo humano fora da cesta básica",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200034",
    exemplos: ["sucos naturais", "queijos", "mel", "farinhas e massas listadas"],
  },
  {
    id: "higiene",
    nome: "Produtos de higiene pessoal e limpeza",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200035",
    exemplos: ["sabonete", "pasta de dente", "papel higiênico", "água sanitária", "sabão em barra", "escova de dente"],
  },
  {
    id: "agro",
    nome: "Produtos agropecuários, pesqueiros e florestais in natura",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200036",
    exemplos: ["gado vivo", "leite cru", "pescado in natura", "madeira em tora", "grãos in natura"],
  },
  {
    id: "insumos-agro",
    nome: "Insumos agropecuários e aquícolas",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200038",
    exemplos: ["fertilizantes", "sementes", "defensivos", "rações", "vacinas veterinárias"],
  },
  {
    id: "cultura",
    nome: "Produções artísticas, culturais, de eventos e audiovisuais nacionais",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200039",
    exemplos: ["espetáculos", "shows nacionais", "produção audiovisual"],
  },
  {
    id: "esporte",
    nome: "Atividades desportivas",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200041",
    exemplos: ["ingresso de evento esportivo", "mensalidade de clube"],
  },
  {
    id: "seguranca",
    nome: "Soberania, segurança nacional e cibersegurança para o poder público",
    reducao: "reducao60",
    cst: "200",
    cClassTrib: "200043",
    exemplos: ["equipamentos de defesa listados"],
  },
  {
    id: "bares-restaurantes",
    nome: "Bares e restaurantes",
    reducao: "reducao40",
    cst: "200",
    cClassTrib: "200047",
    exemplos: ["refeição", "restaurante", "lanchonete", "bar", "marmita"],
  },
  {
    id: "hotelaria",
    nome: "Hotelaria, parques de diversão e parques temáticos",
    reducao: "reducao40",
    cst: "200",
    cClassTrib: "200048",
    exemplos: ["hospedagem", "diária de hotel", "pousada", "parque temático"],
  },
  {
    id: "turismo",
    nome: "Agências de turismo",
    reducao: "reducao40",
    cst: "200",
    cClassTrib: "200051",
    exemplos: ["pacote turístico", "agência de viagens"],
  },
  {
    id: "transporte-intermunicipal",
    nome: "Transporte coletivo de passageiros intermunicipal e interestadual",
    reducao: "reducao40",
    cst: "200",
    cClassTrib: "200049",
    exemplos: ["passagem de ônibus intermunicipal", "passagem interestadual"],
  },
  {
    id: "profissoes-regulamentadas",
    nome: "Serviços de profissões intelectuais regulamentadas",
    reducao: "reducao30",
    cst: "200",
    cClassTrib: "200052",
    exemplos: ["advogados", "advocaticios", "honorarios", "contadores", "contabilidade", "engenheiros", "arquitetos", "economistas", "médicos veterinários", "psicólogos", "administradores"],
  },
  {
    id: "padrao",
    nome: "Demais bens e serviços (alíquota padrão)",
    reducao: "padrao",
    cst: "000",
    cClassTrib: "000001",
    exemplos: ["vestuário", "eletrônicos", "software e SaaS", "marketing", "consultoria não regulamentada", "móveis", "autopeças"],
  },
];

export const CATEGORIA_PADRAO = CATEGORIAS.find((c) => c.id === "padrao")!;

export function categoriaPorId(id: string | null | undefined): Categoria {
  return CATEGORIAS.find((c) => c.id === id) ?? CATEGORIA_PADRAO;
}

/** Regimes específicos que pedem análise própria e não cabem no simulador genérico. */
export const REGIMES_ESPECIFICOS = [
  "Combustíveis",
  "Serviços financeiros",
  "Planos de saúde",
  "Concursos de prognósticos",
  "Operações com bens imóveis",
  "Cooperativas",
  "Sociedades anônimas do futebol",
  "Missões diplomáticas",
];

/** Busca simples por palavra-chave, usada antes (ou no lugar) da IA. */
export function buscarCategoria(termo: string): Categoria[] {
  const t = normalizar(termo);
  if (!t) return [];
  return CATEGORIAS.filter(
    (c) =>
      contemPalavras(normalizar(c.nome), t) ||
      c.exemplos.some((e) => {
        const ex = normalizar(e);
        return contemPalavras(ex, t) || contemPalavras(t, ex);
      }),
  );
}

/** `texto` contém `trecho` como sequência de palavras inteiras ("bar" não casa com "barra"). */
function contemPalavras(texto: string, trecho: string) {
  const esc = trecho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(texto);
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
