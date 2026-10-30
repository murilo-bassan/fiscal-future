/**
 * Monta o EmitenteFiscal a partir do cadastro da empresa e diz, em português,
 * o que falta preencher para emitir. Descriptografa o token do provedor: o
 * resultado só pode circular no servidor.
 */

import type { Empresa } from "@prisma/client";
import { descriptografar } from "../cripto";
import type { Ambiente, EmitenteFiscal, Endereco, IdProvedor, TipoNota } from "./tipos";

export type ResultadoEmitente = { ok: true; emitente: EmitenteFiscal } | { ok: false; faltando: string[] };

type EmpresaFiscal = Pick<
  Empresa,
  | "id"
  | "cnpj"
  | "perfil"
  | "razaoSocial"
  | "inscricaoEstadual"
  | "inscricaoMunicipal"
  | "crt"
  | "endereco"
  | "aliquotaIssPadrao"
  | "ambiente"
  | "provedor"
  | "provedorToken"
  | "serieNfe"
>;

export const CAMPOS_ENDERECO: { chave: keyof Endereco; rotulo: string }[] = [
  { chave: "logradouro", rotulo: "rua (logradouro)" },
  { chave: "numero", rotulo: "número do endereço" },
  { chave: "bairro", rotulo: "bairro" },
  { chave: "cep", rotulo: "CEP" },
  { chave: "municipio", rotulo: "município" },
  { chave: "codigoMunicipio", rotulo: "código IBGE do município" },
  { chave: "uf", rotulo: "UF" },
];

/** Lê o JSON de endereço salvo; campos ausentes viram texto vazio. */
export function lerEndereco(json: string | null | undefined): Endereco {
  let bruto: Record<string, unknown> = {};
  try {
    const v = json ? JSON.parse(json) : {};
    if (v && typeof v === "object") bruto = v as Record<string, unknown>;
  } catch {
    // JSON corrompido: tratamos como vazio e pedimos para preencher de novo
  }
  const s = (k: keyof Endereco) => (typeof bruto[k] === "string" ? (bruto[k] as string).trim() : "");
  return {
    logradouro: s("logradouro"),
    numero: s("numero"),
    bairro: s("bairro"),
    cep: s("cep").replace(/\D/g, ""),
    municipio: s("municipio"),
    codigoMunicipio: s("codigoMunicipio").replace(/\D/g, ""),
    uf: s("uf").toUpperCase(),
  };
}

function lerRegime(perfil: string): EmitenteFiscal["regime"] | null {
  try {
    const r = (JSON.parse(perfil) as { regime?: unknown }).regime;
    return r === "simples" || r === "presumido" || r === "real" ? r : null;
  } catch {
    return null;
  }
}

/**
 * @param tipo Quando informado, também confere o que só aquele tipo de nota
 * exige (IE para NF-e; inscrição municipal e alíquota de ISS para NFS-e).
 */
export function emitenteDaEmpresa(empresa: EmpresaFiscal, tipo?: TipoNota): ResultadoEmitente {
  const faltando: string[] = [];

  const cnpj = (empresa.cnpj ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) faltando.push("CNPJ da empresa (em Editar dados)");

  const razaoSocial = empresa.razaoSocial?.trim() ?? "";
  if (!razaoSocial) faltando.push("razão social");

  const crt = empresa.crt;
  const crtOk = crt === "1" || crt === "2" || crt === "3" || crt === "4";
  if (!crtOk) faltando.push("regime na nota (CRT)");

  const regime = lerRegime(empresa.perfil);
  if (!regime) faltando.push("regime tributário (refaça o cadastro da empresa em Editar dados)");
  else if (crtOk && (crt === "3") !== (regime !== "simples")) {
    faltando.push(
      crt === "3"
        ? "regime: o CRT diz regime normal, mas o cadastro da empresa diz Simples Nacional"
        : "regime: o CRT diz Simples Nacional, mas o cadastro da empresa diz Lucro Presumido ou Real",
    );
  }

  const endereco = lerEndereco(empresa.endereco);
  for (const c of CAMPOS_ENDERECO) if (!endereco[c.chave]) faltando.push(`endereço: ${c.rotulo}`);
  if (endereco.cep && endereco.cep.length !== 8) faltando.push("endereço: CEP com 8 dígitos");
  if (endereco.codigoMunicipio && endereco.codigoMunicipio.length !== 7)
    faltando.push("endereço: código IBGE do município com 7 dígitos");
  if (endereco.uf && !/^[A-Z]{2}$/.test(endereco.uf)) faltando.push("endereço: UF com 2 letras");

  const ie = empresa.inscricaoEstadual?.trim() || undefined;
  const im = empresa.inscricaoMunicipal?.trim() || undefined;
  if (tipo === "nfe" && !ie) faltando.push("inscrição estadual (obrigatória para NF-e)");
  if (tipo === "nfse" && !im) faltando.push("inscrição municipal (obrigatória para NFS-e)");
  if (tipo === "nfse" && empresa.aliquotaIssPadrao == null) faltando.push("alíquota de ISS");

  const serieNfe = (empresa.serieNfe ?? "").trim();
  if (!/^\d{1,3}$/.test(serieNfe)) faltando.push("série da nota (de 0 a 999)");

  const provedor = empresa.provedor as IdProvedor;
  if (provedor !== "simulado" && provedor !== "focus") faltando.push("provedor de emissão");
  const ambiente = empresa.ambiente as Ambiente;
  if (ambiente !== "homologacao" && ambiente !== "producao") faltando.push("ambiente (homologação ou produção)");
  if (ambiente === "producao" && provedor === "simulado") {
    faltando.push("provedor real para emitir em produção (o simulado só serve para teste)");
  }

  let provedorToken: string | undefined;
  if (provedor === "focus") {
    if (!empresa.provedorToken) faltando.push("token do provedor Focus NFe");
    else {
      try {
        provedorToken = descriptografar(empresa.provedorToken);
      } catch {
        faltando.push("token do provedor (não conseguimos ler o token salvo: salve de novo)");
      }
    }
  }

  if (faltando.length) return { ok: false, faltando };
  return {
    ok: true,
    emitente: {
      empresaId: empresa.id,
      cnpj,
      razaoSocial,
      inscricaoEstadual: ie,
      inscricaoMunicipal: im,
      crt: crt as EmitenteFiscal["crt"],
      regime: regime!,
      endereco,
      aliquotaIssPadrao: empresa.aliquotaIssPadrao ?? undefined,
      ambiente,
      provedor,
      provedorToken,
      serieNfe,
    },
  };
}
