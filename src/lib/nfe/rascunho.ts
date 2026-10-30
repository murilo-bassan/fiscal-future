/**
 * Transforma uma nota antiga (já convertida) em rascunho de emissão no modelo
 * novo: mesmos itens, mesmo destinatário, CST/cClassTrib escolhidos na conversão.
 */

import type { RascunhoNota } from "../emissao/tipos";
import type { NotaConvertida } from "./conversor";
import type { NotaLida } from "./parser";

export function rascunhoDeConversao(nota: NotaLida, convertida: NotaConvertida): RascunhoNota {
  const categoria = new Map(convertida.itens.map((i) => [i.nItem, i.categoria.id]));
  const d = nota.destinatario;
  return {
    tipo: "nfe",
    naturezaOperacao: nota.naturezaOperacao || "Venda de mercadoria",
    destinatario: {
      documento: d?.documento ?? "",
      nome: d?.nome ?? "",
      inscricaoEstadual: d?.ie,
      endereco: d ? { uf: d.uf, municipio: d.municipio, codigoMunicipio: d.codigoMunicipio } : undefined,
      // Destinatário com CPF é sempre consumidor final; com CNPJ, o usuário confirma
      consumidorFinal: (d?.documento.length ?? 0) === 11,
    },
    itens: nota.itens.map((it) => ({
      codigo: it.codigo,
      descricao: it.descricao,
      ncm: it.ncm,
      cfop: it.cfop,
      unidade: it.unidade || "UN",
      quantidade: it.quantidade,
      valorUnitario: it.valorUnitario,
      desconto: it.desconto,
      categoriaId: categoria.get(it.nItem) ?? "padrao",
      aliquotaIcms: it.valor > 0 && it.icms > 0 ? Math.round((it.icms / (it.valor - it.desconto)) * 10000) / 10000 : undefined,
    })),
    origemChave: nota.chave,
  };
}
