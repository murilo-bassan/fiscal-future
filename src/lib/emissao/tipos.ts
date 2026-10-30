/**
 * Contrato da emissão de notas. A emissão é feita por um provedor homologado
 * (API de emissão). O Fiscal Future monta a nota com IBS/CBS calculados e guarda o
 * resultado. Escopo da v1:
 *  - NFS-e no padrão nacional (serviços): ISS + IBS/CBS;
 *  - NF-e de venda de mercadoria sem substituição tributária: ICMS próprio,
 *    PIS/Cofins pelo regime e IBS/CBS. Operações complexas (ST, DIFAL,
 *    importação, devolução) continuam no ERP.
 */

import type { CalculoRascunho } from "./calculo";

export type TipoNota = "nfe" | "nfse";
export type Ambiente = "homologacao" | "producao";
export type StatusNota = "processando" | "autorizada" | "rejeitada" | "cancelada" | "erro";
export type IdProvedor = "simulado" | "focus";

export type ItemRascunho = {
  codigo: string;
  descricao: string;
  /** NF-e: NCM (8 dígitos). */
  ncm?: string;
  /** NF-e: CFOP (4 dígitos). */
  cfop?: string;
  /** NFS-e: código de tributação nacional do serviço (cTribNac, 6 dígitos). */
  codigoServico?: string;
  /** NFS-e: código NBS do serviço (9 dígitos). */
  nbs?: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  /** Categoria de src/lib/tax/categorias.ts; define CST e cClassTrib. */
  categoriaId: string;
  /** NF-e, regime normal: alíquota de ICMS do item (fração). */
  aliquotaIcms?: number;
};

export type Endereco = {
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  municipio: string;
  codigoMunicipio: string; // IBGE, 7 dígitos
  uf: string;
};

export type Destinatario = {
  documento: string; // CPF ou CNPJ, só dígitos
  nome: string;
  email?: string;
  inscricaoEstadual?: string;
  endereco?: Partial<Endereco>;
  /** Pessoa física ou empresa que não vai revender: indFinal = 1. */
  consumidorFinal: boolean;
};

export type RascunhoNota = {
  tipo: TipoNota;
  naturezaOperacao: string;
  destinatario: Destinatario;
  itens: ItemRascunho[];
  informacoesAdicionais?: string;
  /** Chave da nota antiga que originou este rascunho (conversão). */
  origemChave?: string;
};

export type EmitenteFiscal = {
  empresaId: string;
  cnpj: string;
  razaoSocial: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  crt: "1" | "2" | "3" | "4";
  /** Regime para PIS/Cofins (só regime normal): presumido = cumulativo, real = não cumulativo. */
  regime: "simples" | "presumido" | "real";
  endereco: Endereco;
  aliquotaIssPadrao?: number;
  ambiente: Ambiente;
  provedor: IdProvedor;
  /** Token do provedor já descriptografado. Nunca enviar ao navegador. */
  provedorToken?: string;
  serieNfe: string;
};

export type ResultadoEmissao = {
  status: StatusNota;
  numero?: string;
  serie?: string;
  chave?: string;
  protocolo?: string;
  mensagem?: string;
  xml?: string;
  xmlUrl?: string;
  danfeUrl?: string;
};

export interface ProvedorFiscal {
  id: IdProvedor;
  nome: string;
  emitir(e: EmitenteFiscal, r: RascunhoNota, calculo: CalculoRascunho, ref: string): Promise<ResultadoEmissao>;
  consultar(e: EmitenteFiscal, tipo: TipoNota, ref: string): Promise<ResultadoEmissao>;
  cancelar(e: EmitenteFiscal, tipo: TipoNota, ref: string, justificativa: string): Promise<ResultadoEmissao>;
}
