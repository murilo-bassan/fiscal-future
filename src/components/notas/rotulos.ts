import type { StatusNota, TipoNota } from "@/lib/emissao/tipos";

export const NOME_TIPO: Record<TipoNota, string> = { nfe: "NF-e", nfse: "NFS-e" };
export const DESCRICAO_TIPO: Record<TipoNota, string> = {
  nfe: "Venda de mercadoria",
  nfse: "Prestação de serviço",
};

export const ROTULO_STATUS: Record<StatusNota, string> = {
  processando: "Processando",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
  erro: "Erro no envio",
};

export const CRTS = [
  { valor: "1", nome: "Simples Nacional", dica: "Microempresa ou empresa de pequeno porte no Simples." },
  {
    valor: "2",
    nome: "Simples, acima do sublimite",
    dica: "Está no Simples, mas passou do sublimite do estado e paga ICMS e ISS por fora do DAS.",
  },
  { valor: "3", nome: "Regime normal", dica: "Lucro Presumido ou Lucro Real." },
  { valor: "4", nome: "MEI", dica: "Microempreendedor individual." },
] as const;

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export function formatarDocumento(d: string) {
  const s = d.replace(/\D/g, "");
  if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return d;
}

/** Máscara progressiva de CPF/CNPJ enquanto digita. */
export function mascararDocumento(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export const dataHora = (d: Date) =>
  d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
export const data = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
