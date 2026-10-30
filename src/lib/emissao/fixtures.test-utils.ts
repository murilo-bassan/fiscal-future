/** Dados de teste compartilhados (não é um arquivo de teste). */
import type { EmitenteFiscal, RascunhoNota } from "./tipos";

export const EMITENTE_NORMAL: EmitenteFiscal = {
  empresaId: "emp1",
  cnpj: "11222333000181",
  razaoSocial: "Distribuidora Exemplo Ltda",
  inscricaoEstadual: "110042490114",
  inscricaoMunicipal: "12345",
  crt: "3",
  regime: "presumido",
  endereco: {
    logradouro: "Rua A",
    numero: "10",
    bairro: "Centro",
    cep: "01001000",
    municipio: "São Paulo",
    codigoMunicipio: "3550308",
    uf: "SP",
  },
  aliquotaIssPadrao: 0.05,
  ambiente: "homologacao",
  provedor: "focus",
  provedorToken: "TOKEN-SECRETO-123",
  serieNfe: "1",
};

export const NFE: RascunhoNota = {
  tipo: "nfe",
  naturezaOperacao: "Venda de mercadoria",
  destinatario: {
    documento: "11444777000161",
    nome: "Cliente & Filhos",
    inscricaoEstadual: "123456789",
    endereco: { uf: "RJ", codigoMunicipio: "3304557", municipio: "Rio de Janeiro" },
    consumidorFinal: false,
  },
  itens: [
    {
      codigo: "A1",
      descricao: "Parafuso",
      ncm: "73181500",
      cfop: "6102",
      unidade: "UN",
      quantidade: 10,
      valorUnitario: 100,
      desconto: 0,
      categoriaId: "padrao",
      aliquotaIcms: 0.12,
    },
    {
      codigo: "A2",
      descricao: "Arroz",
      ncm: "10063021",
      cfop: "6102",
      unidade: "KG",
      quantidade: 2,
      valorUnitario: 50,
      desconto: 10,
      categoriaId: "cesta-basica",
      aliquotaIcms: 0.07,
    },
  ],
};

export const NFSE: RascunhoNota = {
  tipo: "nfse",
  naturezaOperacao: "Prestação de serviço",
  destinatario: { documento: "52998224725", nome: "Maria", consumidorFinal: true },
  itens: [
    {
      codigo: "1",
      descricao: "Consultoria",
      codigoServico: "010101",
      nbs: "115022000",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 1000,
      desconto: 0,
      categoriaId: "padrao",
    },
  ],
};
