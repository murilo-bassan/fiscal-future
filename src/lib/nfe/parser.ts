/**
 * Leitura de XML de NF-e / NFC-e (modelos 55 e 65, layout 4.00), com ou sem
 * protocolo de autorização (nfeProc). Extrai só o que a conversão usa.
 */

import { XMLParser } from "fast-xml-parser";

export const TAMANHO_MAXIMO_XML = 2 * 1024 * 1024;

export type ItemLido = {
  nItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valor: number; // vProd
  desconto: number;
  frete: number;
  seguro: number;
  outros: number;
  icms: number;
  icmsCst: string; // CST ou CSOSN
  pis: number;
  cofins: number;
  ipi: number;
  iss: number;
  /** Se a nota já veio com o grupo IBSCBS (emitida em 2026 no layout novo). */
  ibsCbsOriginal?: { cst: string; cClassTrib: string };
};

export type Participante = {
  documento: string; // CNPJ ou CPF
  nome: string;
  ie?: string;
  uf?: string;
  municipio?: string;
  codigoMunicipio?: string;
};

export type NotaLida = {
  chave: string;
  modelo: "55" | "65";
  serie: string;
  numero: string;
  emissao: string; // ISO
  naturezaOperacao: string;
  autorizada: boolean;
  protocolo?: string;
  crt: string; // 1 Simples, 2 Simples excesso, 3 normal, 4 MEI
  emitente: Participante;
  destinatario?: Participante;
  itens: ItemLido[];
  totais: {
    produtos: number;
    desconto: number;
    icms: number;
    pis: number;
    cofins: number;
    ipi: number;
    nota: number; // vNF
  };
  /** Objeto bruto da NFe (sem assinatura nem protocolo), para regerar o XML. */
  bruto: Record<string, unknown>;
};

export class ErroLeituraNota extends Error {}

type No = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false, // NCM, CFOP e chaves têm zeros à esquerda
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true, // só entidades padrão: DOCTYPE é recusado antes do parse
  isArray: (nome) => nome === "det",
});

const num = (v: unknown) => {
  const n = Number(typeof v === "string" ? v : 0);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const obj = (v: unknown): No => (v && typeof v === "object" ? (v as No) : {});

/** Primeiro subgrupo de um nó de tributo (ex.: ICMS > ICMS00, PIS > PISAliq). */
const subgrupo = (v: unknown): No => {
  const o = obj(v);
  const k = Object.keys(o).find((x) => !x.startsWith("@_"));
  return k ? obj(o[k]) : {};
};

function participante(p: No, endereco: string): Participante {
  const e = obj(p[endereco]);
  return {
    documento: str(p.CNPJ || p.CPF || p.idEstrangeiro),
    nome: str(p.xNome),
    ie: str(p.IE) || undefined,
    uf: str(e.UF) || undefined,
    municipio: str(e.xMun) || undefined,
    codigoMunicipio: str(e.cMun) || undefined,
  };
}

export function lerNota(xml: string): NotaLida {
  if (new TextEncoder().encode(xml).length > TAMANHO_MAXIMO_XML) throw new ErroLeituraNota("Arquivo grande demais (máx. 2 MB).");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ErroLeituraNota("XML com DOCTYPE não é aceito.");

  let doc: No;
  try {
    doc = parser.parse(xml) as No;
  } catch {
    throw new ErroLeituraNota("Não foi possível ler o XML.");
  }

  const proc = obj(doc.nfeProc);
  const nfe = obj(proc.NFe ?? doc.NFe);
  const inf = obj(nfe.infNFe);
  if (!Object.keys(inf).length) {
    throw new ErroLeituraNota("Este arquivo não é uma NF-e ou NFC-e (layout 4.00). Notas de serviço municipais ainda não são lidas.");
  }

  const ide = obj(inf.ide);
  const modelo = str(ide.mod);
  if (modelo !== "55" && modelo !== "65") throw new ErroLeituraNota(`Modelo de nota ${modelo || "desconhecido"} não suportado.`);

  const emit = obj(inf.emit);
  const dest = obj(inf.dest);
  const prot = obj(obj(proc.protNFe).infProt);
  const tot = obj(obj(inf.total).ICMSTot);

  const itens = ((inf.det as unknown[]) ?? []).map((d): ItemLido => {
    const det = obj(d);
    const prod = obj(det.prod);
    const imp = obj(det.imposto);
    const icms = subgrupo(imp.ICMS);
    const ipiTrib = obj(obj(imp.IPI).IPITrib);
    const ibscbs = obj(imp.IBSCBS);
    return {
      nItem: Number(str(det["@_nItem"])) || 0,
      codigo: str(prod.cProd),
      descricao: str(prod.xProd),
      ncm: str(prod.NCM),
      cfop: str(prod.CFOP),
      unidade: str(prod.uCom),
      quantidade: num(prod.qCom),
      valorUnitario: num(prod.vUnCom),
      valor: num(prod.vProd),
      desconto: num(prod.vDesc),
      frete: num(prod.vFrete),
      seguro: num(prod.vSeg),
      outros: num(prod.vOutro),
      icms: num(icms.vICMS),
      icmsCst: str(icms.CST || icms.CSOSN),
      pis: num(subgrupo(imp.PIS).vPIS),
      cofins: num(subgrupo(imp.COFINS).vCOFINS),
      ipi: num(ipiTrib.vIPI),
      iss: num(obj(imp.ISSQN).vISSQN),
      ibsCbsOriginal: ibscbs.CST
        ? { cst: str(ibscbs.CST), cClassTrib: str(ibscbs.cClassTrib) }
        : undefined,
    };
  });

  if (!itens.length) throw new ErroLeituraNota("A nota não tem itens.");

  const { Signature: _assinatura, ...semAssinatura } = nfe;
  void _assinatura;

  return {
    chave: str(prot.chNFe) || str(inf["@_Id"]).replace(/^NFe/, ""),
    modelo,
    serie: str(ide.serie),
    numero: str(ide.nNF),
    emissao: str(ide.dhEmi || ide.dEmi),
    naturezaOperacao: str(ide.natOp),
    autorizada: str(prot.cStat) === "100",
    protocolo: str(prot.nProt) || undefined,
    crt: str(emit.CRT),
    emitente: participante(emit, "enderEmit"),
    destinatario: Object.keys(dest).length ? participante(dest, "enderDest") : undefined,
    itens,
    totais: {
      produtos: num(tot.vProd),
      desconto: num(tot.vDesc),
      icms: num(tot.vICMS),
      pis: num(tot.vPIS),
      cofins: num(tot.vCOFINS),
      ipi: num(tot.vIPI),
      nota: num(tot.vNF),
    },
    bruto: semAssinatura,
  };
}
