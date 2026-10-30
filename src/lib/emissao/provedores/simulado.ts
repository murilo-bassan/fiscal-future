/**
 * Provedor simulado: autoriza na hora, sem contrato, para demonstração.
 * Gera chave de acesso com DV correto, número sequencial por empresa/tipo/série,
 * protocolo fictício e um XML de demonstração (tpAmb=2, SEM VALOR FISCAL).
 *
 * Só funciona em homologação. O acesso ao banco é injetável para os testes.
 */

import { XMLBuilder } from "fast-xml-parser";
import { grupoIBSCBS, grupoIBSCBSTot } from "../../nfe/conversor";
import type { CalculoRascunho } from "../calculo";
import { montarChaveNfe, montarChaveNfse } from "../chave";
import type { EmitenteFiscal, ProvedorFiscal, RascunhoNota, ResultadoEmissao, StatusNota, TipoNota } from "../tipos";

export const PRAZO_CANCELAMENTO_MS = 24 * 60 * 60 * 1000;

export type NotaGuardada = {
  status: StatusNota;
  numero?: string | null;
  serie?: string | null;
  chave?: string | null;
  protocolo?: string | null;
  xml?: string | null;
  /** Momento da autorização (no simulado, a criação da nota). */
  emitidaEm: Date;
};

export type DepsSimulado = {
  /** Maior número já usado pela empresa naquele tipo e série (0 se nenhum). */
  ultimoNumero(empresaId: string, tipo: TipoNota, serie: string): Promise<number>;
  buscar(empresaId: string, ref: string): Promise<NotaGuardada | null>;
  agora(): Date;
  /** Inteiro aleatório em [0, max). */
  aleatorio(max: number): number;
};

const depsBanco: DepsSimulado = {
  async ultimoNumero(empresaId, tipo, serie) {
    const { db } = await import("../../db");
    const notas = await db.notaFiscal.findMany({
      where: { empresaId, tipo, serie, provedor: "simulado", numero: { not: null } },
      select: { numero: true },
    });
    return notas.reduce((m, n) => Math.max(m, Number(n.numero) || 0), 0);
  },
  async buscar(empresaId, ref) {
    const { db } = await import("../../db");
    const n = await db.notaFiscal.findFirst({
      where: { empresaId, ref },
      select: { status: true, numero: true, serie: true, chave: true, protocolo: true, xml: true, createdAt: true },
    });
    return n ? { ...n, status: n.status as StatusNota, emitidaEm: n.createdAt } : null;
  },
  agora: () => new Date(),
  aleatorio: (max) => Math.floor(Math.random() * max),
};

const v2 = (n: number) => n.toFixed(2);
const p2 = (fracao: number) => (fracao * 100).toFixed(2);
const qtd = (n: number) => n.toFixed(4);

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  suppressEmptyNode: true,
  processEntities: true,
});

const AVISO =
  "<!-- SEM VALOR FISCAL: documento gerado pelo provedor SIMULADO do Fiscal Future para demonstração. Não foi enviado à SEFAZ nem à prefeitura. -->";

/** ISO com fuso de Brasília (-03:00), como nos XMLs fiscais. */
function dataHora(d: Date) {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 19) + "-03:00";
}

function docXml(doc: string) {
  return doc.length === 11 ? { CPF: doc } : { CNPJ: doc };
}

export function xmlNfe(
  e: EmitenteFiscal,
  r: RascunhoNota,
  c: CalculoRascunho,
  p: { chave: string; numero: number; protocolo: string; emissao: Date },
): string {
  const d = r.destinatario;
  const ufDest = d.endereco?.uf;
  const idDest = ufDest && ufDest !== e.endereco.uf ? "2" : "1";
  const simples = c.simples;
  const det = r.itens.map((it, i) => {
    const ci = c.itens[i];
    const bruto = it.quantidade * it.valorUnitario;
    const icms = simples
      ? { ICMSSN102: { orig: "0", CSOSN: "102" } }
      : { ICMS00: { orig: "0", CST: "00", modBC: "3", vBC: v2(ci.valor), pICMS: p2(it.aliquotaIcms ?? 0), vICMS: v2(ci.icms) } };
    const pis =
      ci.pis > 0
        ? { PISAliq: { CST: "01", vBC: v2(ci.valor), pPIS: p2(ci.pis / ci.valor), vPIS: v2(ci.pis) } }
        : { PISOutr: { CST: "49", vBC: v2(0), pPIS: p2(0), vPIS: v2(0) } };
    const cofins =
      ci.cofins > 0
        ? { COFINSAliq: { CST: "01", vBC: v2(ci.valor), pCOFINS: p2(ci.cofins / ci.valor), vCOFINS: v2(ci.cofins) } }
        : { COFINSOutr: { CST: "49", vBC: v2(0), pCOFINS: p2(0), vCOFINS: v2(0) } };
    return {
      "@_nItem": String(i + 1),
      prod: {
        cProd: it.codigo,
        cEAN: "SEM GTIN",
        xProd: it.descricao,
        NCM: it.ncm,
        CFOP: it.cfop,
        uCom: it.unidade,
        qCom: qtd(it.quantidade),
        vUnCom: it.valorUnitario.toFixed(4),
        vProd: v2(bruto),
        cEANTrib: "SEM GTIN",
        uTrib: it.unidade,
        qTrib: qtd(it.quantidade),
        vUnTrib: it.valorUnitario.toFixed(4),
        vDesc: it.desconto > 0 ? v2(it.desconto) : undefined,
        indTot: "1",
      },
      imposto: { ICMS: icms, PIS: pis, COFINS: cofins, IBSCBS: grupoIBSCBS(ci.ibsCbs) },
    };
  });

  const t = c.totais;
  const nfe = {
    nfeProc: {
      "@_versao": "4.00",
      "@_xmlns": "http://www.portalfiscal.inf.br/nfe",
      NFe: {
        infNFe: {
          "@_Id": `NFe${p.chave}`,
          "@_versao": "4.00",
          ide: {
            cUF: p.chave.slice(0, 2),
            cNF: p.chave.slice(35, 43),
            natOp: r.naturezaOperacao,
            mod: "55",
            serie: String(Number(e.serieNfe)),
            nNF: String(p.numero),
            dhEmi: dataHora(p.emissao),
            tpNF: "1",
            idDest,
            cMunFG: e.endereco.codigoMunicipio,
            tpImp: "1",
            tpEmis: "1",
            cDV: p.chave.slice(43),
            tpAmb: "2",
            finNFe: "1",
            indFinal: d.consumidorFinal ? "1" : "0",
            indPres: "9",
            procEmi: "0",
            verProc: "FiscalFuture-simulado",
          },
          emit: {
            CNPJ: e.cnpj,
            xNome: e.razaoSocial,
            enderEmit: {
              xLgr: e.endereco.logradouro,
              nro: e.endereco.numero,
              xBairro: e.endereco.bairro,
              cMun: e.endereco.codigoMunicipio,
              xMun: e.endereco.municipio,
              UF: e.endereco.uf,
              CEP: e.endereco.cep,
            },
            IE: e.inscricaoEstadual,
            CRT: e.crt,
          },
          dest: {
            ...docXml(d.documento),
            xNome: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
            indIEDest: d.inscricaoEstadual ? "1" : "9",
            IE: d.inscricaoEstadual,
            email: d.email,
          },
          det,
          total: {
            ICMSTot: {
              vBC: v2(simples ? 0 : t.produtos - t.desconto),
              vICMS: v2(t.icms),
              vProd: v2(t.produtos),
              vDesc: v2(t.desconto),
              vPIS: v2(t.pis),
              vCOFINS: v2(t.cofins),
              vNF: v2(t.nota),
            },
            IBSCBSTot: grupoIBSCBSTot(t),
          },
          transp: { modFrete: "9" },
          infAdic: {
            infCpl: [
              `Destinatario: ${d.nome}`,
              r.informacoesAdicionais,
              c.ano <= 2026 ? "IBS/CBS destacados em carater informativo (LC 214/2025, art. 348)" : undefined,
            ]
              .filter(Boolean)
              .join(" | "),
          },
        },
      },
      protNFe: {
        "@_versao": "4.00",
        infProt: {
          tpAmb: "2",
          verAplic: "FiscalFuture-simulado",
          chNFe: p.chave,
          dhRecbto: dataHora(p.emissao),
          nProt: p.protocolo,
          cStat: "100",
          xMotivo: "Autorizado o uso da NF-e (SIMULADO)",
        },
      },
    },
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${AVISO}\n${builder.build(nfe)}`;
}

export function xmlNfse(
  e: EmitenteFiscal,
  r: RascunhoNota,
  c: CalculoRascunho,
  p: { chave: string; numero: number; protocolo: string; emissao: Date },
): string {
  const it = r.itens[0];
  const ci = c.itens[0];
  const ib = ci.ibsCbs;
  const d = r.destinatario;
  const dps = {
    NFSe: {
      "@_versao": "1.00",
      "@_xmlns": "http://www.sped.fazenda.gov.br/nfse",
      infNFSe: {
        "@_Id": `NFS${p.chave}`,
        xLocEmi: e.endereco.municipio,
        nNFSe: String(p.numero),
        cLocIncid: e.endereco.codigoMunicipio,
        dhProc: dataHora(p.emissao),
        nDFSe: p.protocolo,
        emit: { CNPJ: e.cnpj, IM: e.inscricaoMunicipal, xNome: e.razaoSocial },
        valores: { vBC: v2(ci.valor), pAliqAplic: p2(e.aliquotaIssPadrao ?? 0), vISSQN: v2(ci.iss), vLiq: v2(ci.valor) },
        DPS: {
          "@_versao": "1.00",
          infDPS: {
            tpAmb: "2",
            dhEmi: dataHora(p.emissao),
            verAplic: "FiscalFuture-simulado",
            serie: String(Number(e.serieNfe)),
            nDPS: String(p.numero),
            dCompet: dataHora(p.emissao).slice(0, 10),
            cLocEmi: e.endereco.codigoMunicipio,
            prest: {
              CNPJ: e.cnpj,
              IM: e.inscricaoMunicipal,
              regTrib: { opSimpNac: e.crt === "4" ? "2" : e.crt === "3" ? "1" : "3", regEspTrib: "0" },
            },
            toma: { ...docXml(d.documento), xNome: d.nome, email: d.email },
            serv: {
              locPrest: { cLocPrestacao: e.endereco.codigoMunicipio },
              cServ: { cTribNac: it.codigoServico, xDescServ: it.descricao, cNBS: it.nbs },
            },
            valores: {
              vServPrest: { vServ: v2(ci.valor) },
              trib: {
                tribMun: { tribISSQN: "1", pAliq: p2(e.aliquotaIssPadrao ?? 0), tpRetISSQN: "1" },
              },
            },
            IBSCBS: {
              finNFSe: "0",
              indFinal: d.consumidorFinal ? "1" : "0",
              valores: {
                trib: {
                  gIBSCBS: {
                    CST: ib.cst,
                    cClassTrib: ib.cClassTrib,
                  },
                },
              },
              // Valores calculados pelo Fiscal Future (na NFS-e real, o Sistema Nacional calcula)
              totCIBS: ib.temGrupo
                ? {
                    vBC: v2(ib.base),
                    gIBS: {
                      vIBSTot: v2(ib.vIBS),
                      gIBSUFTot: { pIBSUF: p2(ib.ibsUf.aliquotaEfetiva), vIBSUF: v2(ib.ibsUf.valor) },
                      gIBSMunTot: { pIBSMun: p2(ib.ibsMun.aliquotaEfetiva), vIBSMun: v2(ib.ibsMun.valor) },
                    },
                    gCBS: { pCBS: p2(ib.cbs.aliquotaEfetiva), vCBS: v2(ib.cbs.valor) },
                  }
                : undefined,
            },
          },
        },
      },
    },
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${AVISO}\n${builder.build(dps)}`;
}

function resultadoDe(n: NotaGuardada): ResultadoEmissao {
  return {
    status: n.status,
    numero: n.numero ?? undefined,
    serie: n.serie ?? undefined,
    chave: n.chave ?? undefined,
    protocolo: n.protocolo ?? undefined,
    xml: n.xml ?? undefined,
  };
}

export function criarProvedorSimulado(deps: DepsSimulado = depsBanco): ProvedorFiscal {
  return {
    id: "simulado",
    nome: "Simulado (demonstração)",

    async emitir(e, r, calculo, ref) {
      if (e.ambiente !== "homologacao") {
        return { status: "erro", mensagem: "O provedor simulado só emite em homologação. Para produção, configure um provedor real." };
      }
      // Idempotência: a mesma ref devolve a mesma nota já autorizada
      const existente = await deps.buscar(e.empresaId, ref);
      if (existente?.chave && existente.status !== "erro") return resultadoDe(existente);

      const agora = deps.agora();
      const serie = String(Number(e.serieNfe));
      const numero = (await deps.ultimoNumero(e.empresaId, r.tipo, serie)) + 1;
      const protocolo = `9${String(agora.getFullYear()).slice(2)}${String(deps.aleatorio(1e12)).padStart(12, "0")}`;
      let chave: string;
      let xml: string;
      if (r.tipo === "nfe") {
        let cNF = String(deps.aleatorio(1e8)).padStart(8, "0");
        // cNF não pode repetir o número da nota (regra da SEFAZ)
        if (cNF === String(numero).padStart(8, "0")) cNF = String((Number(cNF) + 1) % 1e8).padStart(8, "0");
        chave = montarChaveNfe({
          cUF: e.endereco.codigoMunicipio.slice(0, 2),
          emissao: agora,
          cnpj: e.cnpj,
          serie,
          numero,
          cNF,
        });
        xml = xmlNfe(e, r, calculo, { chave, numero, protocolo, emissao: agora });
      } else {
        chave = montarChaveNfse({
          codigoMunicipio: e.endereco.codigoMunicipio,
          documento: e.cnpj,
          numero,
          emissao: agora,
          codigoNumerico: deps.aleatorio(1e9),
        });
        xml = xmlNfse(e, r, calculo, { chave, numero, protocolo, emissao: agora });
      }
      return {
        status: "autorizada",
        numero: String(numero),
        serie,
        chave,
        protocolo,
        xml,
        mensagem: "Autorizada no ambiente simulado. Sem valor fiscal.",
      };
    },

    async consultar(e, _tipo, ref) {
      const n = await deps.buscar(e.empresaId, ref);
      if (!n) return { status: "erro", mensagem: "Nota não encontrada no simulado." };
      return resultadoDe(n);
    },

    async cancelar(e, _tipo, ref) {
      const n = await deps.buscar(e.empresaId, ref);
      if (!n) return { status: "erro", mensagem: "Nota não encontrada no simulado." };
      if (n.status === "cancelada") return { ...resultadoDe(n), mensagem: "A nota já estava cancelada." };
      if (n.status !== "autorizada") return { ...resultadoDe(n), mensagem: "Só dá para cancelar nota autorizada." };
      if (deps.agora().getTime() - n.emitidaEm.getTime() > PRAZO_CANCELAMENTO_MS) {
        return {
          ...resultadoDe(n),
          mensagem: "O prazo de cancelamento (24 horas após a autorização) já passou. Neste caso, emita uma nota de devolução ou estorno.",
        };
      }
      return { ...resultadoDe(n), status: "cancelada", mensagem: "Nota cancelada no ambiente simulado." };
    },
  };
}

export const provedorSimulado = criarProvedorSimulado();
